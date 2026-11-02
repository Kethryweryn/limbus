import { TERMS_VERSION } from '../../utils/legal'
import { expect, test, type Locator, type Page } from '@playwright/test'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../integration/constants'
import { E2E_PASSWORD, PARCOURS } from './constants'

export async function login(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto('/')
  // Attendre l'hydratation : avant, le clic soumettrait le formulaire nativement
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

export async function expectLoggedIn(page: Page) {
  await expect(page.locator('header')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeHidden()
}

export async function openUserMenu(page: Page) {
  await page.locator('header [aria-haspopup="menu"]').click()
}

// Nombre d'enregistrements dans la base hors ligne (0 si elle n'existe pas ou a été recréée vide)
export async function offlineRecordCount(page: Page) {
  return await page.evaluate(() => new Promise<number>((resolve) => {
    const request = indexedDB.open('limbus-db')
    request.onsuccess = () => {
      const db = request.result
      const stores = [...db.objectStoreNames]
      if (!stores.length) { db.close(); resolve(0); return }
      const tx = db.transaction(stores)
      let total = 0
      for (const store of stores) {
        const count = tx.objectStore(store).count()
        count.onsuccess = () => { total += count.result }
      }
      tx.oncomplete = () => { db.close(); resolve(total) }
    }
  }))
}

export type TestPrisma = ReturnType<typeof import('../integration/db').createTestPrisma>

// Jeu commun des parcours (ADR-0037) : ses personnages et participants, par nom
export async function parcoursGame(prisma: TestPrisma) {
  const game = await prisma.game.findUniqueOrThrow({
    where: { slug: PARCOURS.gameSlug },
    include: { characters: true, participantLinks: { include: { participant: true } } }
  })
  const character = (name: string) => game.characters.find((item) => item.name === name)!
  const participant = (name: string) => game.participantLinks.map((link) => link.participant).find((item) => item.name === name)!
  return { game, character, participant }
}

// Nom propre à une tentative : une relance en CI (retries) ne retombe pas sur les données de la précédente
export function uniqueName(base: string) {
  return `${base} ${Date.now().toString(36)}`
}

// Le plus petit bloc de la page Inscriptions qui porte à la fois le titre du jeu et le bouton donné
export function gamePanel(page: Page, title: string, button: string | RegExp) {
  return page.locator('div')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .filter({ has: page.getByRole('button', { name: button }) })
    .last()
}

// Compte propre au test, confirmé, aux conditions acceptées et au mot de passe des tests : ses changements ne touchent pas
// les comptes partagés
export async function testUser(prisma: TestPrisma, base: string, role = 'user') {
  const name = uniqueName(base)
  const email = `${slugOf(name)}@example.test`
  const password = await bcrypt.hash(E2E_PASSWORD, 4)
  const user = await prisma.user.create({ data: { email, name, password, role, termsAcceptedVersion: TERMS_VERSION, emailConfirmedAt: new Date() } })
  return { user, email, name }
}

export function slugOf(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
}

// Session du jeu commun, propre au test, avec son casting : [personnage, participant]
export async function parcoursSession(prisma: TestPrisma, base: string, cast: Array<[string, string]> = []) {
  const { game, character, participant } = await parcoursGame(prisma)
  const name = uniqueName(base)
  const slug = slugOf(name)
  const session = await prisma.session.create({
    data: {
      name,
      slug,
      gameId: game.id,
      participants: { create: cast.map(([, person]) => ({ participantId: participant(person).id, role: 'participant' })) },
      assignments: { create: cast.map(([characterName, person]) => ({ characterId: character(characterName).id, participantId: participant(person).id })) }
    }
  })
  return { session, game, character, participant }
}

// Choisit une option dans un USelect (bouton « combobox » de Nuxt UI)
export async function choose(page: Page, combobox: Locator, option: string | RegExp) {
  await combobox.click()
  await page.getByRole('option', { name: option }).click()
}

// Session ouverte directement par cookie, sans passer par l'écran de connexion : les tests des parcours ne
// consomment pas la limite de tentatives de connexion par email (l'écran a ses propres tests, auth.spec.ts)
export async function signIn(page: Page, prisma: TestPrisma, email: string) {
  // Conditions déjà acceptées (US-111) : l'écran d'acceptation a son propre test (legal.spec.ts)
  const user = await prisma.user.update({ where: { email }, data: { termsAcceptedVersion: TERMS_VERSION }, select: { id: true, sessionVersion: true } })
  const token = jwt.sign({ id: user.id, v: user.sessionVersion }, JWT_SECRET, { expiresIn: '1h' })
  await page.context().addCookies([{ name: '__Host-limbus_token', value: token, domain: new URL(test.info().project.use.baseURL!).hostname, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
  await page.goto('/')
  await expectLoggedIn(page)
}
