// US-200 : la liste et la fiche des participants (SPEC-007 R1 à R9, R14 ; SPEC-011 R10, R12 ; SPEC-010)
import { expect, type Page } from '@playwright/test'
import { TERMS_VERSION } from '../../utils/legal'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { choose, gamePerson, orgaGame, orgaSession, signIn, slugOf, test, uniqueName, type TestPrisma } from './helpers'

// Jeu d'une autre équipe, celle du compte « autre »
async function otherTeamGame(prisma: TestPrisma, base: string) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.autre } })
  const title = uniqueName(base)
  return await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
}

async function openParticipants(page: Page) {
  await page.goto('/participants')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: 'Participants' })).toBeVisible()
}

async function openSheet(page: Page, person: { slug: string, name: string }) {
  await page.goto(`/participants/${person.slug}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible()
}

// Carte d'un participant : son nom est un lien, et non un titre comme dans les autres listes
function personCard(page: Page, name: string) {
  return page.locator('.cursor-pointer').filter({ has: page.getByRole('link', { name, exact: true }) })
}

test('liste : recherche par nom et par email, filtre par jeu, pages, et création refusée sans nom ni jeu (R1, R3b)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de la liste des participants')
    const base = uniqueName('Personne listée')
    await Promise.all(Array.from({ length: 10 }, (_, index) => {
      const name = `${base} ${String(index + 1).padStart(2, '0')}`
      return prisma.participant.create({ data: { name, slug: slugOf(name), email: index === 0 ? `adresse-unique-${slugOf(base)}@example.test` : null, gameLinks: { create: { gameId: game.id } } } })
    }))
    await signIn(page, prisma, E2E_USERS.orga)
    await openParticipants(page)

    await choose(page, page.getByRole('combobox').filter({ hasText: 'Tous les jeux' }), game.title)
    await expect(page.getByText('Page 1 / 2')).toBeVisible()
    await page.getByRole('button', { name: 'Suivant →' }).click()
    await expect(page.getByText('Page 2 / 2')).toBeVisible()

    // Recherche par l'email : une seule fiche, et retour à la page 1
    await page.getByPlaceholder('Rechercher un participant...').fill(`adresse-unique-${slugOf(base)}`)
    await expect(page.getByText('Page 1 / 1')).toBeVisible()
    await expect(personCard(page, `${base} 01`)).toBeVisible()
    await expect(personCard(page, `${base} 02`)).toHaveCount(0)

    // Création : sans nom ni jeu, les deux messages ; rien n'est créé
    await page.getByRole('combobox').filter({ hasText: game.title }).click()
    await page.getByRole('option', { name: 'Tous les jeux', exact: true }).click()
    await page.getByRole('button', { name: 'Créer un participant' }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form.getByText('Le nom est requis.')).toBeVisible()
    await expect(form.getByText('Choisissez au moins un jeu.')).toBeVisible()
    await expect(form).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

test('fiche : un jeu ajouté puis retiré, ses notes propres, et le retrait du dernier jeu supprime la fiche (R3b, R4, SPEC-011 R10)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const first = await orgaGame(prisma, 'Premier jeu de la fiche')
    const second = await orgaGame(prisma, 'Second jeu de la fiche')
    const person = await gamePerson(prisma, first.id, 'Personne aux deux jeux')
    const session = await orgaSession(prisma, second.id, 'Session du second jeu')
    await signIn(page, prisma, E2E_USERS.orga)
    await openSheet(page, person)

    // Ajout du second jeu, avec une note propre à ce jeu
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByRole('button', { name: 'Jeux' }).click()
    await page.getByRole('option', { name: second.title }).click()
    await page.keyboard.press('Escape')
    await page.getByLabel(`Notes — ${second.title}`).fill('Note du second jeu')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    // Le formulaire se ferme : l'adresse perd son « ?edit=1 » avant tout rechargement
    await expect(page.getByRole('button', { name: 'Modifier' })).toBeVisible()
    await expect.poll(() => prisma.participantGame.findMany({ where: { participantId: person.id }, select: { gameId: true, notes: true }, orderBy: { createdAt: 'asc' } }))
      .toEqual([{ gameId: first.id, notes: null }, { gameId: second.id, notes: 'Note du second jeu' }])
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: person.id, role: 'participant' } })

    // Retrait du second jeu : la personne quitte aussi ses sessions (R4)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByRole('button', { name: 'Jeux' }).click()
    await page.getByRole('option', { name: second.title }).click()
    await page.keyboard.press('Escape')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('button', { name: 'Modifier' })).toBeVisible()
    await expect.poll(() => prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: person.id } })).toBe(0)
    expect(await prisma.participantGame.count({ where: { participantId: person.id } })).toBe(1)

    // Retrait du dernier jeu : la fiche est supprimée (R3b)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByRole('button', { name: 'Jeux' }).click()
    await page.getByRole('option', { name: first.title }).click()
    await page.keyboard.press('Escape')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect.poll(() => prisma.participant.findUnique({ where: { id: person.id } })).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

test('fiche : les coordonnées d’une personne qui a un compte ne se modifient pas par l’équipe (SPEC-011 R12)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu d’une personne avec compte')
    const name = uniqueName('Personne avec compte')
    const email = `${slugOf(name)}@example.test`
    const user = await prisma.user.create({ data: { email, name, password: 'non-utilise', role: 'user', termsAcceptedVersion: TERMS_VERSION, emailConfirmedAt: new Date() } })
    const person = await prisma.participant.create({ data: { name, slug: slugOf(name), email, userId: user.id, gameLinks: { create: { gameId: game.id } } } })
    await signIn(page, prisma, E2E_USERS.orga)
    await openSheet(page, person)

    await page.getByRole('button', { name: 'Modifier' }).click()
    await expect(page.getByLabel('Nom', { exact: true })).toBeDisabled()
    await expect(page.getByLabel('Téléphone', { exact: true })).toBeDisabled()
    await expect(page.getByText('Tenu par la personne depuis son compte.').first()).toBeVisible()
    // Les notes de l'équipe, elles, restent à l'équipe
    await expect(page.getByLabel(`Notes — ${game.title}`)).toBeEnabled()
  } finally {
    await prisma.$disconnect()
  }
})

test('export : il ne contient que les jeux de l’organisatrice qui exporte (R7, R8)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de l’export')
    const foreign = await otherTeamGame(prisma, 'Jeu d’une autre équipe à l’export')
    const person = await gamePerson(prisma, game.id, 'Personne exportée')
    await prisma.participantGame.create({ data: { participantId: person.id, gameId: foreign.id, notes: 'Note de l’autre équipe' } })
    await signIn(page, prisma, E2E_USERS.orga)
    await openSheet(page, person)

    const download = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Exporter ses données' }).click()
    const file = await (await download).path()
    const { readFileSync } = await import('node:fs')
    const text = readFileSync(file, 'utf8')
    expect(text).toContain(game.title)
    expect(text).not.toContain(foreign.title)
    expect(text).not.toContain('Note de l’autre équipe')
  } finally {
    await prisma.$disconnect()
  }
})

test('suppression : depuis la fiche, refusée si la personne est liée au jeu d’une autre équipe, faite sinon (R9, US-211)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de la suppression d’une fiche')
    const foreign = await otherTeamGame(prisma, 'Jeu d’une autre équipe à la suppression')
    const shared = await gamePerson(prisma, game.id, 'Personne partagée')
    await prisma.participantGame.create({ data: { participantId: shared.id, gameId: foreign.id } })
    const alone = await gamePerson(prisma, game.id, 'Personne seule')
    await signIn(page, prisma, E2E_USERS.orga)

    // Depuis la liste : le refus s'affiche (US-211)
    await openParticipants(page)
    await page.getByPlaceholder('Rechercher un participant...').fill(shared.name)
    page.once('dialog', (dialog) => dialog.accept())
    await personCard(page, shared.name).getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.getByText('Ce participant est lié à des jeux auxquels vous n’avez pas accès')).toBeVisible()

    // Depuis la fiche : même refus
    await openSheet(page, shared)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.getByText('Ce participant est lié à des jeux auxquels vous n’avez pas accès')).toBeVisible()
    expect(await prisma.participant.findUnique({ where: { id: shared.id } })).not.toBeNull()

    // Une fiche liée à ses seuls jeux : supprimée, retour à la liste
    await openSheet(page, alone)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Supprimer' }).click()
    await expect(page).toHaveURL(/\/participants$/)
    await expect.poll(() => prisma.participant.findUnique({ where: { id: alone.id } })).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

test('droits et conflit : une fiche d’une autre équipe est introuvable, et deux modifications simultanées ne s’écrasent pas (R6, R14)', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du conflit de fiche')
    const foreign = await otherTeamGame(prisma, 'Jeu de l’autre équipe aux droits')
    const person = await gamePerson(prisma, game.id, 'Personne disputée')
    const stranger = await gamePerson(prisma, foreign.id, 'Personne d’une autre équipe')
    await signIn(page, prisma, E2E_USERS.orga)

    await page.goto(`/participants/${stranger.slug}`)
    await expect(page.getByRole('heading', { name: 'Page introuvable' }).or(page.getByText('Participant introuvable'))).toBeVisible()

    // Deux onglets ouvrent la même fiche ; le premier enregistre, le second est refusé (R6)
    const second = await otherPage()
    await signIn(second, prisma, E2E_USERS.orga)
    await openSheet(page, person)
    await openSheet(second, person)
    await page.getByRole('button', { name: 'Modifier' }).click()
    await second.getByRole('button', { name: 'Modifier' }).click()
    await page.getByLabel('Téléphone', { exact: true }).fill('0611111111')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect.poll(async () => (await prisma.participant.findUniqueOrThrow({ where: { id: person.id } })).phone).toBe('0611111111')
    await second.getByLabel('Téléphone', { exact: true }).fill('0622222222')
    await second.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(second.getByText('Cet élément a été modifié par quelqu’un d’autre entre-temps.', { exact: false })).toBeVisible()
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: person.id } })).phone).toBe('0611111111')
  } finally {
    await prisma.$disconnect()
  }
})

test('hors ligne : la fiche se relit, et une modification part au retour du réseau (SPEC-010 R5)', async ({ page, context }) => {
  test.setTimeout(90_000)
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de la fiche hors ligne')
    const person = await gamePerson(prisma, game.id, 'Personne hors ligne')
    await signIn(page, prisma, E2E_USERS.orga)
    await openParticipants(page)
    await openSheet(page, person)

    await context.setOffline(true)
    await page.getByRole('link', { name: 'Participants', exact: true }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Participants' })).toBeVisible()
    await page.getByPlaceholder('Rechercher un participant...').fill(person.name)
    await expect(personCard(page, person.name)).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible()

    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByLabel('Téléphone', { exact: true }).fill('0633333333')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText(/Modifications faites hors ligne : 1 en attente/)).toBeVisible()
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: person.id } })).phone).toBeNull()

    await context.setOffline(false)
    await expect.poll(async () => (await prisma.participant.findUniqueOrThrow({ where: { id: person.id } })).phone, { timeout: 20_000 }).toBe('0633333333')
  } finally {
    await prisma.$disconnect()
  }
})

