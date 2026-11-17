import { expect, test, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { gamePerson, orgaGame, orgaSession, signIn, slugOf, testUser, uniquePersonName } from './helpers'

// SPEC-023, US-251 : un nom de personne ne contient que des lettres et des séparateurs ; le refus s'affiche sous son champ
const refusal = (label: string) => `${label} ne peut contenir que des lettres, des espaces, des traits d’union, des apostrophes et des points`
const FIELDS_INVALID = 'Certaines informations sont manquantes ou incorrectes.'

// Message affiché sous le champ de ce libellé (UFormField)
function fieldError(page: Page, label: string, message: string) {
  return page.locator('[data-slot="root"]').filter({ has: page.getByLabel(label, { exact: true }) }).getByText(message)
}

test('Mon compte : un nom ou un nom de contact d’urgence avec un chiffre est refusé sous son champ, un nom accentué s’enregistre', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { user, email, name } = await testUser(prisma, 'Compte aux noms vérifiés')
    await signIn(page, prisma, email)
    await page.goto('/compte')
    await page.waitForLoadState('networkidle')

    // Erreurs de saisie : rien n'est enregistré
    await page.getByLabel('Nom', { exact: true }).fill('Jean2')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(fieldError(page, 'Nom', refusal('Le nom'))).toBeVisible()
    await expect(page.getByText(FIELDS_INVALID)).toBeVisible()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe(name)

    await page.getByLabel('Contact d’urgence : nom', { exact: true }).fill('Paul 2')
    await page.getByLabel('Contact d’urgence : téléphone', { exact: true }).fill('0611111111')
    await page.getByRole('button', { name: 'Enregistrer mes coordonnées' }).click()
    await expect(fieldError(page, 'Contact d’urgence : nom', refusal('Le nom du contact d’urgence'))).toBeVisible()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emergencyContactName).toBeNull()

    // Actions : accents, apostrophe, point et trait d'union passent ; les espaces en trop sont retirés
    await page.getByLabel('Nom', { exact: true }).fill('  Zoë   D’Arc-Ŝ. ')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByText('Nom enregistré.')).toBeVisible()
    await expect(fieldError(page, 'Nom', refusal('Le nom'))).toBeHidden()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe('Zoë D’Arc-Ŝ.')
  } finally {
    await prisma.$disconnect()
  }
})

test('fiche participant : un nom avec un chiffre est refusé sous le champ, sans rien créer', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu des noms de participants')
    const email = `${slugOf(uniquePersonName('iris chiffre'))}@example.test`
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/participants')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Créer un participant' }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('button', { name: 'Jeux' }).click()
    await page.getByRole('option', { name: game.title }).click()
    await page.keyboard.press('Escape')
    await form.getByLabel('Nom', { exact: true }).fill('Iris 2')
    await form.getByLabel('Email').fill(email)
    await form.getByRole('button', { name: 'Créer' }).click()
    await expect(fieldError(page, 'Nom', refusal('Le nom'))).toBeVisible()
    await expect(form).toBeVisible()
    expect(await prisma.participant.count({ where: { email } })).toBe(0)

    const name = uniquePersonName('Iris D’Arc')
    await form.getByLabel('Nom', { exact: true }).fill(name)
    await form.getByRole('button', { name: 'Créer' }).click()
    await expect(form).toBeHidden()
    await expect.poll(async () => (await prisma.participantGame.findFirst({ where: { gameId: game.id, participant: { email } } }))?.name).toBe(name)
  } finally {
    await prisma.$disconnect()
  }
})

test('questionnaire : un prénom avec un chiffre est refusé sous le champ, sans rien enregistrer', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du prénom vérifié')
    const session = await orgaSession(prisma, game.id, 'Session du prénom vérifié', { date: new Date('2099-05-15T09:00:00Z') })
    const period = await prisma.registrationPeriod.create({
      data: { gameId: game.id, publicId: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } }
    })
    const email = `${slugOf(uniquePersonName('marie chiffre'))}@example.test`
    await page.goto(`/i/${period.publicId}`)
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Prénom').fill('Marie2')
    await page.getByLabel('Nom', { exact: true }).fill('Curie')
    await page.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    await page.getByLabel('Contact d’urgence : nom').fill('Pierre')
    await page.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
    await page.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await page.getByRole('button', { name: 'M’inscrire' }).click()

    await expect(page.getByText(refusal('Le prénom'))).toBeVisible()
    await expect(page.getByText(FIELDS_INVALID)).toBeVisible()
    expect(await prisma.registrationRequest.count({ where: { email } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})

test('hors ligne : un nom invalide saisi sur une fiche est refusé au retour du réseau, avec son message', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du nom hors ligne')
    const person = await gamePerson(prisma, game.id, 'Personne au nom hors ligne', '')
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/participants/${person.slug}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible()

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByLabel('Nom', { exact: true }).fill('Personne 2')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText(/Modifications faites hors ligne : 1 en attente/)).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText(/Modifications faites hors ligne : 1 erreur/)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Voir les modifications' }).click()
    await expect(page.getByRole('dialog').getByText(refusal('Le nom'))).toBeVisible()
    expect((await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: person.id, gameId: game.id } } })).name).toBe(person.name)
  } finally {
    await context.setOffline(false)
    await prisma.$disconnect()
  }
})
