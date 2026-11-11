// US-199 : la liste des sessions, ses détails, son cast et son déroulé (SPEC-004 R1 à R3, R5 à R9, R12, R13)
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { cardByTitle, choose, gamePerson, labelled, orgaGame, orgaSession as ownSession, signIn, slugOf, test, uniqueDate, uniqueName } from './helpers'

const DAY_MS = 24 * 60 * 60 * 1000

async function openSession(page: Page, session: { slug: string, label: string }, tab?: string) {
  await page.goto(`/sessions/${session.slug}${tab ? `?tab=${tab}` : ''}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: session.label })).toBeVisible()
}

async function openSessions(page: Page, gameTitle: string) {
  await page.goto('/sessions')
  await page.waitForLoadState('networkidle')
  await choose(page, page.getByRole('combobox').filter({ hasText: 'Tous les jeux' }), gameTitle)
}

function section(page: Page, title: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: title }) })
}

test('liste : sessions à venir par date, passées et annulées à part, période, recherche et pages', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu liste des sessions')
    const now = Date.now()
    const later = await ownSession(prisma, game.id, 'Session lointaine', { date: new Date(now + 60 * DAY_MS) })
    const sooner = await ownSession(prisma, game.id, 'Session proche', { date: new Date(now + 10 * DAY_MS) })
    const cancelled = await ownSession(prisma, game.id, 'Session annulée', { date: new Date(now + 20 * DAY_MS), status: 'cancelled' })
    const past = await ownSession(prisma, game.id, 'Session passée', { date: new Date(now - 10 * DAY_MS) })
    await signIn(page, prisma, E2E_USERS.orga)
    await openSessions(page, game.title)

    // Par défaut, les sessions à venir, de la plus proche à la plus lointaine
    await choose(page, page.getByRole('combobox').filter({ hasText: /^(Futur|Passé|Tout)$/ }), 'Tout')
    const future = section(page, 'Sessions à venir')
    await expect(future.getByRole('heading', { level: 3 })).toHaveText([sooner.label, later.label])
    // Annulée, même à venir, elle est rangée avec les passées (US-020), de la plus récente à la plus ancienne
    await expect(section(page, 'Sessions passées').getByRole('heading', { level: 3 })).toHaveText([cancelled.label, past.label])

    await choose(page, page.getByRole('combobox').filter({ hasText: 'Tout' }), 'Passé')
    await expect(section(page, 'Sessions à venir')).toHaveCount(0)
    await expect(section(page, 'Sessions passées').getByRole('heading', { level: 3 })).toHaveCount(2)

    // Recherche par le nom
    await choose(page, page.getByRole('combobox').filter({ hasText: 'Passé' }), 'Tout')
    await page.getByPlaceholder('Rechercher une session...').fill(sooner.label)
    await expect(page.getByRole('heading', { level: 3 })).toHaveText([sooner.label])

    // Pages de 5 sessions par partie
    await page.getByPlaceholder('Rechercher une session...').fill('')
    await Promise.all([0, 1, 2, 3].map((index) => ownSession(prisma, game.id, `Session en plus ${index}`, { date: new Date(now + (30 + index) * DAY_MS) })))
    await page.reload()
    await page.waitForLoadState('networkidle')
    await choose(page, page.getByRole('combobox').filter({ hasText: 'Tous les jeux' }), game.title)
    await expect(section(page, 'Sessions à venir').getByText('Page 1 / 2')).toBeVisible()
    await section(page, 'Sessions à venir').getByRole('button', { name: 'Suivant →' }).click()
    await expect(section(page, 'Sessions à venir').getByText('Page 2 / 2')).toBeVisible()
    await expect(section(page, 'Sessions à venir').getByRole('heading', { level: 3 })).toHaveText([later.label])
  } finally {
    await prisma.$disconnect()
  }
})

test('carte : un clic ouvre la session, « Modifier » ouvre son formulaire, et une session payée ne se supprime ni de la liste ni de sa fiche (US-209, R3)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu carte des sessions')
    const paid = await ownSession(prisma, game.id, 'Session payée')
    const person = await gamePerson(prisma, game.id, 'Personne qui a payé')
    await prisma.sessionParticipant.create({ data: { sessionId: paid.id, participantId: person.id, role: 'participant' } })
    await prisma.sessionPayment.create({ data: { gameId: game.id, sessionId: paid.id, participantId: person.id, paidAt: new Date() } })
    const free = await ownSession(prisma, game.id, 'Session sans paiement')
    await signIn(page, prisma, E2E_USERS.orga)
    await openSessions(page, game.title)

    // Un raccourci d'onglet ouvre la session sur cet onglet, et non sur celui de la carte
    await cardByTitle(page, free.label).getByRole('link', { name: 'Paiements' }).click()
    await expect(page).toHaveURL(new RegExp(`/sessions/${free.slug}\\?tab=payments$`))
    await expect(page.getByRole('heading', { level: 1, name: free.label })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Paiements', exact: true })).toHaveClass(/bg-primary/)
    await openSessions(page, game.title)

    // « Modifier » ouvre le formulaire, sans ouvrir la session
    await cardByTitle(page, free.label).getByRole('button', { name: 'Modifier' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveURL(/\/sessions$/)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()

    // Supprimer depuis la liste : refusé pour la session payée, avec le message qui oriente vers l'annulation
    page.once('dialog', (dialog) => dialog.accept())
    await cardByTitle(page, paid.label).getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.getByText(/ne peut pas être supprimée\. Annulez-la ou reportez-la/)).toBeVisible()
    expect(await prisma.session.findUnique({ where: { id: paid.id } })).not.toBeNull()

    // Un clic sur la carte, hors de ses boutons, ouvre la session ; sa fiche refuse aussi la suppression
    await cardByTitle(page, paid.label).getByText('Lieu', { exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: paid.label })).toBeVisible()
    expect(page.url()).toContain(`/sessions/${paid.slug}`)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.getByText(/ne peut pas être supprimée/)).toBeVisible()
    expect(await prisma.session.findUnique({ where: { id: paid.id } })).not.toBeNull()

    // Sans paiement ni inscription : supprimée depuis sa fiche, retour à la liste
    await openSession(page, free)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Supprimer' }).click()
    await expect(page).toHaveURL(/\/sessions$/)
    await expect.poll(() => prisma.session.findUnique({ where: { id: free.id } })).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

test('détails : pas de nom à saisir, lieu du même jeu seulement, statut libre, visible sur la page publique (R1, R2, R2b)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu détails de session')
    const other = await orgaGame(prisma, 'Autre jeu détails')
    const ownLocation = uniqueName('Lieu du jeu')
    const foreignLocation = uniqueName('Lieu d’un autre jeu')
    await prisma.location.create({ data: { name: ownLocation, slug: slugOf(ownLocation), gameId: game.id } })
    await prisma.location.create({ data: { name: foreignLocation, slug: slugOf(foreignLocation), gameId: other.id } })
    const session = await ownSession(prisma, game.id, 'Session détaillée', { status: 'cancelled' })
    await signIn(page, prisma, E2E_USERS.orga)
    await openSession(page, session)

    await page.getByRole('button', { name: 'Modifier' }).first().click()
    // Une session n'a pas de nom (SPEC-021, R1)
    await expect(page.getByLabel('Nom', { exact: true })).toHaveCount(0)

    // Le lieu se choisit parmi ceux du jeu (R1)
    await page.getByLabel('Lieu', { exact: true }).click()
    await expect(page.getByRole('option', { name: ownLocation })).toBeVisible()
    await expect(page.getByRole('option', { name: foreignLocation })).toHaveCount(0)
    await page.getByRole('option', { name: ownLocation }).click()

    // Une session annulée redevient prévue (R2), et devient visible sur la page publique (R2b)
    await choose(page, page.getByLabel('Statut', { exact: true }), 'Prévue')
    await page.getByLabel('Visible sur la page publique').check()
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Visible sur la page publique', { exact: true })).toBeVisible()
    await expect.poll(() => prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { status: true, published: true, location: { select: { name: true } } } }))
      .toEqual({ status: 'scheduled', published: true, location: { name: ownLocation } })
  } finally {
    await prisma.$disconnect()
  }
})

test('cast : un PNJ seulement à l’organisation ou aux PNJ, un PJ rend la personne participante, deux PJ à la même personne selon le réglage du jeu (R6 à R9)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du cast')
    const pj1 = uniqueName('PJ un')
    const pj2 = uniqueName('PJ deux')
    const pnj = uniqueName('PNJ garde')
    for (const [name, type] of [[pj1, 'pj'], [pj2, 'pj'], [pnj, 'pnj']] as const) {
      await prisma.character.create({ data: { name, slug: slugOf(name), gameId: game.id, type } })
    }
    const player = await gamePerson(prisma, game.id, 'Joueuse')
    const organizer = await gamePerson(prisma, game.id, 'Organisatrice')
    const session = await ownSession(prisma, game.id, 'Session castée')
    await prisma.sessionParticipant.createMany({ data: [
      { sessionId: session.id, participantId: player.id, role: 'participant' },
      { sessionId: session.id, participantId: organizer.id, role: 'organizer' }
    ] })
    await signIn(page, prisma, E2E_USERS.orga)
    await openSession(page, session, 'cast')
    const row = (character: string) => page.locator('form > div.grid').filter({ hasText: character })

    // PNJ : seule l'organisatrice est proposée (R8)
    await row(pnj).getByRole('combobox').click()
    await expect(page.getByRole('option', { name: organizer.name })).toBeVisible()
    await expect(page.getByRole('option', { name: player.name })).toHaveCount(0)
    await page.getByRole('option', { name: organizer.name }).click()

    // Deux PJ à la même joueuse : refusé, le jeu n'en permet qu'un (R7)
    await choose(page, row(pj1).getByRole('combobox'), player.name)
    await choose(page, row(pj2).getByRole('combobox'), player.name)
    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
    await expect(page.getByText(/joue plusieurs PJ dans cette session/)).toBeVisible()
    expect(await prisma.sessionAssignment.count({ where: { sessionId: session.id, participantId: { not: null } } })).toBe(0)

    // « Aucun participant » libère le second PJ (US-205) ; le premier se donne à l'organisatrice, qui garde son seul rôle :
    // le rôle « participant » n'est ajouté qu'à qui n'organise pas et n'est pas PNJ (R9)
    await choose(page, row(pj2).getByRole('combobox'), 'Aucun participant')
    await choose(page, row(pj1).getByRole('combobox'), organizer.name)
    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
    await expect.poll(() => prisma.sessionAssignment.findFirst({ where: { sessionId: session.id, character: { name: pj1 } }, select: { participantId: true } })).toEqual({ participantId: organizer.id })
    expect(await prisma.sessionParticipant.findMany({ where: { sessionId: session.id, participantId: organizer.id }, select: { role: true } })).toEqual([{ role: 'organizer' }])
    expect(await prisma.sessionAssignment.findFirst({ where: { sessionId: session.id, character: { name: pj2 } }, select: { participantId: true } })).toEqual({ participantId: null })

    // Le jeu permet plusieurs PJ : la même personne en joue deux (R7)
    await prisma.game.update({ where: { id: game.id }, data: { singlePjPerParticipant: false } })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await choose(page, row(pj2).getByRole('combobox'), organizer.name)
    await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
    await expect.poll(() => prisma.sessionAssignment.count({ where: { sessionId: session.id, participantId: organizer.id } })).toBe(3)
  } finally {
    await prisma.$disconnect()
  }
})

test('déroulé : les responsables se choisissent parmi l’organisation et les PNJ, et le compte suit (R12, R13)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu du déroulé')
    const player = await gamePerson(prisma, game.id, 'Joueur du déroulé')
    const npc = await gamePerson(prisma, game.id, 'PNJ du déroulé')
    const session = await ownSession(prisma, game.id, 'Session déroulée')
    await prisma.sessionParticipant.createMany({ data: [
      { sessionId: session.id, participantId: player.id, role: 'participant' },
      { sessionId: session.id, participantId: npc.id, role: 'npc' }
    ] })
    const eventName = uniqueName('Arrivée du messager')
    const event = await prisma.timelineEvent.create({ data: { name: eventName, slug: slugOf(eventName), gameId: game.id, day: 1, time: '15:00', requiredResponsibles: 2 } })
    await signIn(page, prisma, E2E_USERS.orga)
    await openSession(page, session, 'timeline')

    await expect(page.getByLabel(`Assigner ${npc.name} à ${eventName}`)).toBeVisible()
    await expect(page.getByLabel(`Assigner ${player.name} à ${eventName}`)).toHaveCount(0)
    await page.getByLabel(`Assigner ${npc.name} à ${eventName}`).check()
    await expect(page.locator('article').filter({ hasText: eventName }).getByText('1/2', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Enregistrer la timeline' }).click()
    await expect.poll(() => prisma.timelineEventResponsible.findMany({ where: { sessionId: session.id, timelineEventId: event.id }, select: { participantId: true } }))
      .toEqual([{ participantId: npc.id }])

    // Décocher puis enregistrer remplace les affectations (R13)
    await page.getByLabel(`Assigner ${npc.name} à ${eventName}`).uncheck()
    await page.getByRole('button', { name: 'Enregistrer la timeline' }).click()
    await expect.poll(() => prisma.timelineEventResponsible.count({ where: { sessionId: session.id } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})

test('droits : une organisatrice sans accès ne voit pas la session, une co-organisatrice la modifie (R14)', async ({ otherPage }) => {
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu des droits de session')
    const shared = await orgaGame(prisma, 'Jeu partagé de session')
    const hidden = await ownSession(prisma, game.id, 'Session privée', { date: uniqueDate() })
    const visible = await ownSession(prisma, shared.id, 'Session partagée', { date: uniqueDate() })
    const autre = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.autre } })
    await prisma.gameShare.create({ data: { gameId: shared.id, userId: autre.id } })
    const guest = await otherPage()
    await signIn(guest, prisma, E2E_USERS.autre)

    await guest.goto('/sessions')
    await guest.waitForLoadState('networkidle')
    await guest.getByPlaceholder('Rechercher une session...').fill('Session')
    await expect(guest.getByRole('heading', { level: 3, name: visible.label })).toBeVisible()
    await expect(guest.getByRole('heading', { level: 3, name: hidden.label })).toHaveCount(0)
    await guest.goto(`/sessions/${hidden.slug}`)
    await expect(guest.getByRole('heading', { name: 'Page introuvable' }).or(guest.getByText('Session introuvable'))).toBeVisible()

    // La co-organisatrice modifie la session du jeu partagé
    await openSession(guest, visible)
    await guest.getByRole('button', { name: 'Modifier' }).first().click()
    await guest.getByLabel('Date', { exact: true }).fill('2099-11-11T11:00')
    await guest.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(guest.getByRole('heading', { level: 1, name: 'Session du 11 novembre 2099' })).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

test('hors ligne : la liste des sessions se relit, et une session créée sans réseau part au retour du réseau (SPEC-010 R5)', async ({ page, context }) => {
  test.setTimeout(90_000)
  const prisma = createTestPrisma()
  try {
    const game = await orgaGame(prisma, 'Jeu des sessions hors ligne')
    const known = await ownSession(prisma, game.id, 'Session connue', { date: uniqueDate() })
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/games')
    await page.waitForLoadState('networkidle')
    await openSessions(page, game.title)
    await expect(page.getByRole('heading', { level: 3, name: known.label })).toBeVisible()

    await context.setOffline(true)
    await page.getByRole('link', { name: 'Jeux', exact: true }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Jeux' })).toBeVisible()
    await page.getByRole('link', { name: 'Sessions', exact: true }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sessions' })).toBeVisible()
    await page.getByPlaceholder('Rechercher une session...').fill(known.label)
    await expect(page.getByRole('heading', { level: 3, name: known.label })).toBeVisible()

    await page.getByRole('button', { name: 'Créer une session' }).click()
    const form = page.getByRole('dialog')
    await choose(page, form.getByLabel('Jeu', { exact: true }), game.title)
    await form.getByLabel('Date', { exact: true }).fill('2099-12-24T18:00')
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(page.getByText(/Modifications faites hors ligne : 1 en attente/)).toBeVisible()
    expect(await prisma.session.count({ where: { gameId: game.id } })).toBe(1)

    // Au retour du réseau, elle prend son libellé (SPEC-021)
    await context.setOffline(false)
    await expect.poll(async () => {
      const created = await prisma.session.findFirst({ where: { gameId: game.id, date: { gte: new Date('2099-12-24T00:00:00Z'), lt: new Date('2099-12-25T00:00:00Z') } }, select: { id: true } })
      return created && (await labelled(prisma, created)).label
    }, { timeout: 20_000 }).toBe('Session du 24 décembre 2099')
  } finally {
    await prisma.$disconnect()
  }
})
