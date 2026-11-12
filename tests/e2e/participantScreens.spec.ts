// US-200 : la liste et la fiche des participants (SPEC-007 R1 à R9, R14 ; SPEC-011 R10, R12 ; SPEC-010)
import { expect, type Page } from '@playwright/test'
import { TERMS_VERSION } from '../../utils/legal'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { castSession, choose, gameCharacter, gamePerson, orgaGame, orgaSession, signIn, slugOf, test, testUser, uniqueName, type TestPrisma } from './helpers'
import { withFicheValues } from '../fiche'

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
      return withFicheValues(prisma.participant.create({ data: { slug: slugOf(name), email: index === 0 ? `adresse-unique-${slugOf(base)}@example.test` : null, gameLinks: { create: { gameId: game.id , name: name } } } }), { name: name })
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
    // Une fiche appartient à la personne de son adresse (SPEC-022 R3, US-238)
    await expect(form.getByText('L’adresse email est obligatoire.')).toBeVisible()
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
    const person = await gamePerson(prisma, first.id, 'Personne aux deux jeux', '')
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
    const person = await withFicheValues(prisma.participant.create({ data: { slug: slugOf(name), email, userId: user.id, gameLinks: { create: { gameId: game.id , name: name } } } }), { name: name })
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
    await prisma.participantGame.create({ data: { participantId: person.id, gameId: foreign.id, name: 'Personne exportée chez l’autre équipe', notes: 'Note de l’autre équipe' } })
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

test('suppression : une fiche suivie par une autre équipe ne perd que mes jeux ; une fiche à moi seule disparaît (R9, US-211, US-241)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de la suppression d’une fiche')
    const foreign = await otherTeamGame(prisma, 'Jeu d’une autre équipe à la suppression')
    const shared = await gamePerson(prisma, game.id, 'Personne partagée')
    await prisma.participantGame.create({ data: { participantId: shared.id, gameId: foreign.id, name: 'Nom de l’autre équipe', notes: 'Note de l’autre équipe' } })
    const alone = await gamePerson(prisma, game.id, 'Personne seule')
    await signIn(page, prisma, E2E_USERS.orga)

    // Depuis la liste : la carte disparaît, la fiche reste à l'autre équipe, avec ses seuls jeu, nom et note (SPEC-022 R14)
    await openParticipants(page)
    await page.getByPlaceholder('Rechercher un participant...').fill(shared.name)
    page.once('dialog', (dialog) => dialog.accept())
    await personCard(page, shared.name).getByRole('button', { name: 'Supprimer' }).click()
    await expect(personCard(page, shared.name)).toHaveCount(0)
    await expect.poll(async () => (await prisma.participantGame.findMany({ where: { participantId: shared.id }, select: { gameId: true, name: true, notes: true } })))
      .toEqual([{ gameId: foreign.id, name: 'Nom de l’autre équipe', notes: 'Note de l’autre équipe' }])

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
    const person = await gamePerson(prisma, game.id, 'Personne disputée', '')
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
    await expect.poll(async () => (await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: person.id, gameId: game.id } } })).phone).toBe('0611111111')
    await second.getByLabel('Téléphone', { exact: true }).fill('0622222222')
    await second.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(second.getByText('Cet élément a été modifié par quelqu’un d’autre entre-temps.', { exact: false })).toBeVisible()
    expect((await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: person.id, gameId: game.id } } })).phone).toBe('0611111111')
  } finally {
    await prisma.$disconnect()
  }
})

test('hors ligne : la fiche se relit, et une modification part au retour du réseau (SPEC-010 R5)', async ({ page, context }) => {
  test.setTimeout(90_000)
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de la fiche hors ligne')
    const person = await gamePerson(prisma, game.id, 'Personne hors ligne', '')
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
    expect((await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: person.id, gameId: game.id } } })).phone).toBeNull()

    await context.setOffline(false)
    await expect.poll(async () => (await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: person.id, gameId: game.id } } })).phone, { timeout: 20_000 }).toBe('0633333333')
  } finally {
    await prisma.$disconnect()
  }
})


// US-237 (SPEC-022 R6, ADR-0086) : nom et téléphone tenus par jeu, version par équipe
test('nom par jeu : une co-organisatrice ne change que son jeu, et une autre équipe ne fait pas refuser ma modification (US-237)', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  try {
    const mine = await orgaGame(prisma, 'Jeu de l’orga au nom par jeu')
    const shared = await orgaGame(prisma, 'Jeu partagé au nom par jeu')
    const foreign = await otherTeamGame(prisma, 'Jeu de l’autre équipe au nom par jeu')
    const coorga = await testUser(prisma, 'Co-organisatrice du nom par jeu')
    await prisma.gameShare.create({ data: { gameId: shared.id, userId: coorga.user.id } })
    const person = await gamePerson(prisma, mine.id, 'Personne au nom par jeu', '')
    await prisma.participantGame.createMany({ data: [shared, foreign].map((game) => ({ participantId: person.id, gameId: game.id, name: person.name })) })
    const role = await gameCharacter(prisma, mine.id, 'Rôle du jeu de l’orga')
    const sharedRole = await gameCharacter(prisma, shared.id, 'Rôle du jeu partagé')
    const mySession = await castSession(prisma, mine.id, 'Session de l’orga', [[role, person]])
    const sharedSession = await castSession(prisma, shared.id, 'Session partagée', [[sharedRole, person]])

    // La co-organisatrice ne voit que le jeu partagé : son nouveau nom ne vaut que pour lui
    const second = await otherPage()
    await signIn(second, prisma, coorga.email)
    await openSheet(second, person)
    const renamed = uniqueName('Nom donné par la co-organisatrice')
    await second.getByRole('button', { name: 'Modifier' }).click()
    await second.getByLabel('Nom', { exact: true }).fill(renamed)
    await second.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(second.getByRole('heading', { level: 1, name: renamed })).toBeVisible()
    const links = async () => Object.fromEntries((await prisma.participantGame.findMany({ where: { participantId: person.id }, select: { gameId: true, name: true } })).map((link) => [link.gameId, link.name]))
    expect(await links()).toEqual({ [mine.id]: person.name, [shared.id]: renamed, [foreign.id]: person.name })

    // L'organisatrice lit, dans chaque session, le nom du jeu de la session
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${mySession.slug}?tab=cast`)
    await expect(page.getByRole('heading', { level: 1, name: mySession.label })).toBeVisible()
    await expect(page.getByText(person.name).first()).toBeVisible()
    await expect(page.getByText(renamed)).toHaveCount(0)
    await page.goto(`/sessions/${sharedSession.slug}?tab=cast`)
    await expect(page.getByRole('heading', { level: 1, name: sharedSession.label })).toBeVisible()
    await expect(page.getByText(renamed).first()).toBeVisible()

    // Une modification de l'autre équipe, sur son jeu, ne refuse pas celle de l'organisatrice, ouverte avant
    const { slug } = await prisma.participant.findUniqueOrThrow({ where: { id: person.id }, select: { slug: true } })
    await page.goto(`/participants/${slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Modifier' }).click()
    await prisma.participantGame.update({ where: { participantId_gameId: { participantId: person.id, gameId: foreign.id } }, data: { phone: '0699999999' } })
    await page.getByLabel('Téléphone', { exact: true }).fill('0644444444')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect.poll(async () => (await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: person.id, gameId: mine.id } } })).phone).toBe('0644444444')
    await expect(page.getByText('Cet élément a été modifié par quelqu’un d’autre entre-temps.', { exact: false })).toHaveCount(0)
    // L'autre équipe garde son téléphone
    expect((await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: person.id, gameId: foreign.id } } })).phone).toBe('0699999999')
  } finally {
    await prisma.$disconnect()
  }
})

// US-238 (SPEC-022 R3) : l'adresse est obligatoire ; les fiches d'avant sont signalées, filtrées, et complétées
test('email obligatoire : une fiche sans email est signalée et filtrée, et ne s’enregistre qu’avec une adresse, même hors ligne (US-238)', async ({ page, context }) => {
  test.setTimeout(90_000)
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu des fiches sans email')
    const foreign = await otherTeamGame(prisma, 'Jeu de l’autre équipe sans email')
    const legacy = await gamePerson(prisma, game.id, 'Personne sans email')
    const withEmail = await gamePerson(prisma, game.id, 'Personne avec email', '')
    const stranger = await gamePerson(prisma, foreign.id, 'Personne sans email d’une autre équipe')
    // Adresse d'avant la vérification, mal formée : signalée elle aussi
    const malformed = await gamePerson(prisma, game.id, 'Personne à l’adresse mal formée')
    await prisma.participant.update({ where: { id: malformed.id }, data: { email: 'à demander' } })
    await signIn(page, prisma, E2E_USERS.orga)
    await openParticipants(page)

    // Mention et filtre : seules les fiches sans email, et des seuls jeux visibles
    await page.getByPlaceholder('Rechercher un participant...').fill(legacy.name)
    await expect(personCard(page, legacy.name).getByText('Sans email', { exact: true })).toBeVisible()
    await page.getByRole('checkbox', { name: /^Sans email \(\d+\)$/ }).check()
    await page.getByPlaceholder('Rechercher un participant...').fill(legacy.name)
    await expect(personCard(page, legacy.name)).toBeVisible()
    await page.getByPlaceholder('Rechercher un participant...').fill(withEmail.name)
    await expect(personCard(page, withEmail.name)).toHaveCount(0)
    await page.getByPlaceholder('Rechercher un participant...').fill(stranger.name)
    await expect(personCard(page, stranger.name)).toHaveCount(0)
    await page.getByPlaceholder('Rechercher un participant...').fill(malformed.name)
    await expect(personCard(page, malformed.name).getByText('Email invalide', { exact: true })).toBeVisible()

    // Modifier une fiche sans email demande une adresse ; rien n'est enregistré
    await openSheet(page, legacy)
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByLabel('Téléphone', { exact: true }).fill('0655555555')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('L’adresse email est obligatoire.')).toBeVisible()
    expect((await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: legacy.id, gameId: game.id } } })).phone).toBeNull()

    // Hors ligne : refusée avant la mise en file, rien n'attend le réseau
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('L’adresse email est obligatoire.')).toBeVisible()
    await expect(page.getByText(/Modifications faites hors ligne/)).toHaveCount(0)
    // Une adresse mal formée aussi, avant la mise en file
    await page.getByLabel('Email', { exact: true }).fill('pas-une-adresse')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Email invalide.')).toBeVisible()
    await expect(page.getByText(/Modifications faites hors ligne/)).toHaveCount(0)
    await context.setOffline(false)

    // Avec une adresse, la fiche s'enregistre
    const address = `${slugOf(legacy.name)}@example.test`
    await page.getByLabel('Email', { exact: true }).fill(address)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect.poll(async () => (await prisma.participant.findUniqueOrThrow({ where: { id: legacy.id } })).email).toBe(address)
    expect((await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: legacy.id, gameId: game.id } } })).phone).toBe('0655555555')
  } finally {
    await context.setOffline(false)
    await prisma.$disconnect()
  }
})

// US-239 (SPEC-022 R7) : corriger l'adresse d'une fiche commune ne vaut que pour l'équipe qui la corrige
test('corriger l’adresse : seuls mes jeux passent à la fiche de la nouvelle adresse, l’autre équipe garde la sienne (US-239)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu de l’adresse corrigée')
    const foreign = await otherTeamGame(prisma, 'Jeu de l’autre équipe à l’adresse gardée')
    const person = await gamePerson(prisma, game.id, 'Personne à l’adresse corrigée', '')
    await prisma.participantGame.create({ data: { participantId: person.id, gameId: foreign.id, name: 'Nom chez l’autre équipe', notes: 'Note de l’autre équipe' } })
    await signIn(page, prisma, E2E_USERS.orga)
    await openSheet(page, person)

    const corrected = `corrigee-${slugOf(person.name)}@example.test`
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByLabel('Email', { exact: true }).fill(corrected)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect.poll(async () => (await prisma.participant.findFirst({ where: { email: corrected }, select: { id: true } }))?.id).toBeTruthy()
    const target = await prisma.participant.findFirstOrThrow({ where: { email: corrected }, select: { id: true, slug: true } })
    await expect(page).toHaveURL(new RegExp(`/participants/${target.slug}$`))
    await expect(page.getByText(corrected)).toBeVisible()
    await expect(page.getByText('Nom chez l’autre équipe')).toHaveCount(0)
    // La fiche d'origine reste à l'autre équipe, avec son adresse
    const original = await prisma.participant.findUniqueOrThrow({ where: { id: person.id }, select: { email: true, gameLinks: { select: { gameId: true } } } })
    expect(original).toEqual({ email: person.email, gameLinks: [{ gameId: foreign.id }] })
    expect(target.id).not.toBe(person.id)
  } finally {
    await prisma.$disconnect()
  }
})
