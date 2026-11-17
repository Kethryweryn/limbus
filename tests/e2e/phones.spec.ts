import { expect, test, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { gamePerson, orgaGame, orgaSession, signIn, slugOf, testUser, uniquePersonName } from './helpers'

// SPEC-023, US-252 : téléphones vérifiés selon leur pays et rangés au format international, contact d'urgence complet
const INVALID = 'Numéro de téléphone invalide'

// Message affiché sous le champ de ce libellé (UFormField)
function fieldError(page: Page, label: string, message: string) {
  return page.locator('[data-slot="root"]').filter({ has: page.getByLabel(label, { exact: true }) }).getByText(message)
}

test('Mes coordonnées : un numéro invalide ou un contact d’urgence à moitié rempli est refusé sous son champ, un numéro avec points se range au format international', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { user, email } = await testUser(prisma, 'Compte aux téléphones vérifiés')
    await signIn(page, prisma, email)
    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    const save = page.getByRole('button', { name: 'Enregistrer mes coordonnées' })

    // Erreurs de saisie : rien n'est enregistré
    await page.getByLabel('Téléphone', { exact: true }).fill('06 12 34')
    await save.click()
    await expect(fieldError(page, 'Téléphone', INVALID)).toBeVisible()

    await page.getByLabel('Téléphone', { exact: true }).fill('')
    await page.getByLabel('Contact d’urgence : nom', { exact: true }).fill('Paul Martin')
    await save.click()
    await expect(fieldError(page, 'Contact d’urgence : téléphone', 'Le téléphone du contact d’urgence est obligatoire')).toBeVisible()
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, emergencyContactName: true } })).toEqual({ phone: null, emergencyContactName: null })

    // Actions : numéro français avec points, numéro belge ; relus au format rangé
    await page.getByLabel('Téléphone', { exact: true }).fill('06.12.34.56.78')
    await page.getByLabel('Contact d’urgence : téléphone', { exact: true }).fill('+32 470 12 34 56')
    await save.click()
    await expect(page.getByText('Coordonnées enregistrées : vos fiches et inscriptions sont à jour.')).toBeVisible()
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, emergencyContactPhone: true } })).toEqual({ phone: '+33612345678', emergencyContactPhone: '+32470123456' })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('Téléphone', { exact: true })).toHaveValue('+33612345678')
  } finally {
    await prisma.$disconnect()
  }
})

test('fiche participant : un numéro invalide est refusé sous le champ, un numéro belge s’enregistre au format rangé', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu des téléphones des participants')
    const name = uniquePersonName('Iris Téléphone')
    const email = `${slugOf(name)}@example.test`
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/participants')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Créer un participant' }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('button', { name: 'Jeux' }).click()
    await page.getByRole('option', { name: game.title }).click()
    await page.keyboard.press('Escape')
    await form.getByLabel('Nom', { exact: true }).fill(name)
    await form.getByLabel('Email').fill(email)
    await form.getByLabel('Téléphone', { exact: true }).fill('bonjour')
    await form.getByRole('button', { name: 'Créer' }).click()
    await expect(fieldError(page, 'Téléphone', INVALID)).toBeVisible()
    expect(await prisma.participant.count({ where: { email } })).toBe(0)

    await form.getByLabel('Téléphone', { exact: true }).fill('+32 470 12 34 56')
    await form.getByRole('button', { name: 'Créer' }).click()
    await expect(form).toBeHidden()
    await expect.poll(async () => (await prisma.participantGame.findFirst({ where: { gameId: game.id, participant: { email } } }))?.phone).toBe('+32470123456')
  } finally {
    await prisma.$disconnect()
  }
})

test('questionnaire : un téléphone invalide est refusé sous le champ ; un numéro avec espaces est rangé au format international', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du téléphone du questionnaire')
    const session = await orgaSession(prisma, game.id, 'Session du téléphone du questionnaire', { date: new Date('2099-05-15T09:00:00Z') })
    const period = await prisma.registrationPeriod.create({
      data: { gameId: game.id, publicId: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } }
    })
    const email = `${slugOf(uniquePersonName('marie telephone'))}@example.test`
    await page.goto(`/i/${period.publicId}`)
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Prénom').fill('Marie')
    await page.getByLabel('Nom', { exact: true }).fill('Curie')
    await page.getByLabel('Téléphone', { exact: true }).fill('06 12 34 56 78')
    await page.getByLabel('Contact d’urgence : nom').fill('Pierre Curie')
    await page.getByLabel('Contact d’urgence : téléphone').fill('12')
    await page.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await page.getByRole('button', { name: 'M’inscrire' }).click()
    await expect(page.getByText(INVALID)).toBeVisible()
    expect(await prisma.registrationRequest.count({ where: { email } })).toBe(0)

    await page.getByLabel('Contact d’urgence : téléphone').fill('06 98 76 54 32')
    await page.getByRole('button', { name: 'M’inscrire' }).click()
    await expect.poll(async () => (await prisma.registrationRequest.findFirst({ where: { email } }))?.answers).toMatchObject({ phone: '+33612345678', emergencyContactPhone: '+33698765432' })
  } finally {
    await prisma.$disconnect()
  }
})

test('hors ligne : un téléphone invalide saisi sur une fiche est refusé au retour du réseau, avec son message', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du téléphone hors ligne')
    const person = await gamePerson(prisma, game.id, 'Personne au téléphone hors ligne', '')
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/participants/${person.slug}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible()

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByLabel('Téléphone', { exact: true }).fill('06 12 34')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText(/Modifications faites hors ligne : 1 en attente/)).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByText(/Modifications faites hors ligne : 1 erreur/)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Voir les modifications' }).click()
    await expect(page.getByRole('dialog').getByText(INVALID)).toBeVisible()
    expect((await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: person.id, gameId: game.id } } })).phone).toBeNull()
  } finally {
    await context.setOffline(false)
    await prisma.$disconnect()
  }
})
