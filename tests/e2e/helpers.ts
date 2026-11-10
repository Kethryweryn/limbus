import { TERMS_VERSION } from '../../utils/legal'
import { expect, test as base, type BrowserContext, type Locator, type Page } from '@playwright/test'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../integration/constants'
import { E2E_PASSWORD, E2E_USERS, PARCOURS } from './constants'
import { escapeRegExp } from '../regexp'
import type { UserRole } from '~/generated/prisma/enums'

// Tests des parcours : `otherPage()` ouvre un navigateur à part (autre personne, autre appareil), fermé à la fin du test
export const test = base.extend<{ otherPage: () => Promise<Page> }>({
  otherPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async () => {
      const context = await browser.newContext()
      contexts.push(context)
      return await context.newPage()
    })
    await Promise.all(contexts.map((context) => context.close()))
  }
})

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

// Nom propre à une tentative : une relance en CI (retries) ne retombe pas sur les données de la précédente, et deux
// tests lancés à la même milliseconde (navigateurs en parallèle, --repeat-each) ne prennent pas le même nom
export function uniqueName(base: string) {
  return `${base} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

// Le plus petit bloc de la page Inscriptions qui porte à la fois le titre du jeu et le bouton donné
// Bloc d'un jeu sur la page Inscriptions, dont le titre est un titre de niveau 2. Jamais un bloc qui contient aussi le
// titre d'un autre jeu : tant que le bouton n'est pas affiché (sessions encore en lecture), on attend, au lieu de
// prendre la liste de tous les jeux, où un autre jeu peut avoir le même texte
export function gamePanel(page: Page, title: string, button: string | RegExp) {
  const otherGame = page.getByRole('heading', { level: 2 }).filter({ hasNotText: new RegExp(`^\\s*${escapeRegExp(title)}\\s*$`) })
  return blockWith(page, page.getByRole('heading', { name: title, exact: true }), button, otherGame)
}

// Le plus petit bloc qui contient à la fois l'élément donné (titre, lien) et le bouton donné : une carte, un panneau.
// `hasNot` écarte les blocs trop larges, qui contiennent aussi un élément d'un autre bloc
export function blockWith(page: Page, has: Locator, button: string | RegExp, hasNot?: Locator) {
  const blocks = page.locator('div')
    .filter({ has })
    .filter({ has: page.getByRole('button', { name: button }) })
  return (hasNot ? blocks.filter({ hasNot }) : blocks).last()
}

// Compte propre au test, confirmé, aux conditions acceptées et au mot de passe des tests : ses changements ne touchent pas
// les comptes partagés
export async function testUser(prisma: TestPrisma, base: string, role: UserRole = 'user') {
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

// Participant du jeu commun, propre au test : les emails qu'il reçoit ne se mêlent pas à ceux des tests voisins,
// qui tournent en parallèle
export async function parcoursPerson(prisma: TestPrisma, base: string) {
  const { game } = await parcoursGame(prisma)
  const name = uniqueName(base)
  const email = `${slugOf(name)}@example.test`
  await prisma.participant.create({ data: { name, slug: slugOf(name), email, gameLinks: { create: { gameId: game.id } } } })
  return { name, email }
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

// Jeu propre au test, de l'organisatrice des parcours (US-198) ; `published: false` en fait un jeu archivé (ADR-0027)
export async function orgaGame(prisma: TestPrisma, base: string, data: { published?: boolean, publicPage?: boolean } = {}) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
  const title = uniqueName(base)
  return await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id, ...data } })
}

// Carte cliquable d'une liste, par son titre ; celui d'un objet en plusieurs exemplaires finit par sa quantité (« × 3 »)
export function cardByTitle(page: Page, title: string) {
  return page.locator('[role="link"]').filter({ has: page.getByRole('heading', { name: new RegExp(`^${escapeRegExp(title)}( × \\d+)?$`) }) })
}

// Session d'un jeu propre au test (US-199)
export async function orgaSession(prisma: TestPrisma, gameId: string, base: string, data: { date?: Date, status?: 'scheduled' | 'postponed' | 'cancelled' | 'completed', locationId?: string } = {}) {
  const name = uniqueName(base)
  return await prisma.session.create({ data: { name, slug: slugOf(name), gameId, ...data } })
}

// Personne liée au jeu donné (US-199). Sans `emailPrefix`, elle n'a pas d'email et aucun envoi ne lui part ; avec, son
// adresse lui est propre (un préfixe « refuse » la fait rejeter par le serveur d'emails de test)
export async function gamePerson(prisma: TestPrisma, gameId: string, base: string, emailPrefix?: string) {
  const name = uniqueName(base)
  const email = emailPrefix === undefined ? undefined : `${emailPrefix}${slugOf(name)}@example.test`
  return await prisma.participant.create({ data: { name, slug: slugOf(name), email, gameLinks: { create: { gameId } } } })
}

// Personnage du jeu donné (US-199)
export async function gameCharacter(prisma: TestPrisma, gameId: string, base: string, data: { type?: 'pj' | 'pnj', excludeFromTrombinoscope?: boolean, sheetReadyToSend?: boolean } = {}) {
  const name = uniqueName(base)
  return await prisma.character.create({ data: { name, slug: slugOf(name), gameId, ...data } })
}

// Session castée du jeu donné : chaque personne joue son personnage, avec le rôle « participant » (US-199)
export async function castSession(prisma: TestPrisma, gameId: string, base: string, cast: Array<[{ id: string }, { id: string }]>) {
  const session = await orgaSession(prisma, gameId, base)
  await prisma.sessionParticipant.createMany({ data: cast.map(([, who]) => ({ sessionId: session.id, participantId: who.id, role: 'participant' as const })) })
  await prisma.sessionAssignment.createMany({ data: cast.map(([role, who]) => ({ gameId, sessionId: session.id, characterId: role.id, participantId: who.id })) })
  return session
}
