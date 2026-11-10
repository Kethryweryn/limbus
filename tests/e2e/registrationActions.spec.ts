import { createHash, randomBytes } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { openRegistrations, registrationTab, signIn, slugOf, type TestPrisma, uniqueName } from './helpers'

// Jeu propre au test, avec une session et un vivier ouvert
async function testPeriod(prisma: TestPrisma, key: string) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-09-01T09:00:00Z') } })
  const period = await prisma.registrationPeriod.create({
    data: { gameId: game.id, publicId: `p${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id } } }
  })
  return { game, session, period }
}

// Personne invitée (email parti), ou inscrite à la session
async function invitedPerson(prisma: TestPrisma, ids: { gameId: string, sessionId: string, periodId: string }, name: string, status: 'invited' | 'confirmed' = 'invited') {
  const slug = slugOf(uniqueName(name))
  const email = `${slug}@example.test`
  const participant = await prisma.participant.create({ data: { name, slug, email, gameLinks: { create: { gameId: ids.gameId } } } })
  if (status === 'confirmed') await prisma.sessionParticipant.create({ data: { sessionId: ids.sessionId, participantId: participant.id, role: 'participant' } })
  const registration = await prisma.registration.create({
    data: {
      gameId: ids.gameId, periodId: ids.periodId, participantId: participant.id, status: status === 'confirmed' ? 'received' : 'invited', source: 'invitation', email,
      links: { create: { tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex') } },
      invitationSentAt: new Date(), responseDueAt: new Date(Date.now() + 7 * 86_400_000),
      ...(status === 'confirmed'
        ? { respondedAt: new Date(), sessionLines: { create: { sessionId: ids.sessionId, status: 'confirmed', confirmedAt: new Date() } } }
        : { invitedSessionId: ids.sessionId })
    }
  })
  return { participant, registration, email }
}

// La page d'un seul jeu (SPEC-020) : ses onglets se lisent dans la page entière
async function openOwnRegistrations(page: Page, prisma: TestPrisma, gameTitle: string, tab?: 'Vivier' | 'Réglages') {
  await signIn(page, prisma, E2E_USERS.orga)
  await openRegistrations(page, gameTitle, tab)
  return page.getByRole('main')
}

// EPIC-001 (US-005) : relance, prolongation, nouveau lien, libération et annulation d'une invitation
test('l’équipe relance, prolonge, renvoie, libère et annule des invitations', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const key = `actions-${Date.now()}`
    const { game, session, period } = await testPeriod(prisma, key)
    const ids = { gameId: game.id, sessionId: session.id, periodId: period.id }
    const ana = await invitedPerson(prisma, ids, 'Ana Actions')
    const ben = await invitedPerson(prisma, ids, 'Ben Actions')

    const panel = await openOwnRegistrations(page, prisma, game.title, 'Vivier')
    const row = (name: string) => panel.locator('li').filter({ hasText: name })
    await expect(panel.getByText('Invitations sans réponse : 2')).toBeVisible()

    // Relance : un email de rappel, et la date de relance sur la ligne
    page.once('dialog', (dialog) => dialog.accept())
    await row('Ana Actions').getByRole('button', { name: 'Relancer' }).click()
    await expect(page.getByText('Rappel envoyé à Ana Actions.')).toBeVisible()
    await expect(row('Ana Actions').getByText(/relancée le/)).toBeVisible()
    await expect.poll(() => mailbox.to(ana.email).length).toBe(1)

    // Prolongation : la modale propose une semaine après l'échéance, la nouvelle date est enregistrée
    await row('Ana Actions').getByRole('button', { name: 'Prolonger' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Prolonger l’échéance de Ana Actions')).toBeVisible()
    // Moins d'un an : au-delà, le champ refuse la date
    const due = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
    await dialog.getByLabel('Nouvelle échéance').fill(due)
    await dialog.getByRole('button', { name: 'Prolonger' }).click()
    await expect(page.getByText('Échéance de Ana Actions prolongée.')).toBeVisible()
    await expect(dialog).toBeHidden()
    const extended = await prisma.registration.findUniqueOrThrow({ where: { id: ana.registration.id }, select: { responseDueAt: true } })
    expect(extended.responseDueAt!.toISOString().slice(0, 10)).toBe(due)

    // Nouveau lien : l'ancien jeton ne vaut plus, un email part
    const linksOfBen = async () => (await prisma.registrationLink.findMany({ where: { registrationId: ben.registration.id }, select: { tokenHash: true } })).map((link) => link.tokenHash)
    const before = await linksOfBen()
    page.once('dialog', (dialog) => dialog.accept())
    await row('Ben Actions').getByRole('button', { name: 'Nouveau lien' }).click()
    await expect(page.getByText('Nouveau lien envoyé à Ben Actions.')).toBeVisible()
    const after = await linksOfBen()
    expect(after).toHaveLength(1)
    expect(before).not.toContain(after[0])
    await expect.poll(() => mailbox.to(ben.email).length).toBe(1)

    // Libération : l'invitation est retirée par l'organisatrice, la personne est sortie du vivier
    page.once('dialog', (dialog) => dialog.accept())
    await row('Ben Actions').getByRole('button', { name: 'Libérer' }).click()
    await expect(page.getByText('Invitation de Ben Actions libérée.')).toBeVisible()
    await expect(panel.getByText('Sorties du vivier : 1')).toBeVisible()
    await expect(row('Ben Actions')).toHaveCount(1)
    await expect(row('Ben Actions').getByRole('button', { name: 'Relancer' })).toHaveCount(0)
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: ben.registration.id }, select: { status: true, withdrawnById: true } }))
      .toEqual({ status: 'withdrawn', withdrawnById: owner.id })

    // Annulation : l'invitation disparaît
    page.once('dialog', (dialog) => dialog.accept())
    await row('Ana Actions').getByRole('button', { name: 'Annuler' }).click()
    await expect(page.getByText('Invitation de Ana Actions annulée.')).toBeVisible()
    await expect(row('Ana Actions')).toHaveCount(0)
    expect(await prisma.registration.count({ where: { id: ana.registration.id } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})

// US-005, R19 : détail d'une personne inscrite, retrait de la session, puis du vivier
test('l’équipe consulte le détail d’une personne inscrite, la retire de la session, puis du vivier', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `retrait-${Date.now()}`
    const { game, session, period } = await testPeriod(prisma, key)
    const cleo = await invitedPerson(prisma, { gameId: game.id, sessionId: session.id, periodId: period.id }, 'Cléo Retrait', 'confirmed')

    const panel = await openOwnRegistrations(page, prisma, game.title)
    const row = panel.locator(`[data-session="${session.name}"] li`).filter({ hasText: 'Cléo Retrait' })

    await row.getByRole('button', { name: 'Détail' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Cléo Retrait' })).toBeVisible()
    await expect(dialog.getByText('Contact', { exact: true })).toBeVisible()
    await expect(dialog.getByText(cleo.email)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: 'Retirer' }).click()
    await expect(page.getByText('Cléo Retrait a été retirée de la session.')).toBeVisible()
    await expect(row).toHaveCount(0)
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: cleo.participant.id } })).toBe(0)
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: cleo.registration.id }, select: { status: true } })).status).toBe('received')

    // Elle reste dans le vivier, d'où on peut aussi la retirer
    await registrationTab(page, 'Vivier')
    const inPool = panel.locator('li').filter({ hasText: 'Cléo Retrait' })
    await expect(inPool.getByText(/annulation/)).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await inPool.getByRole('button', { name: 'Retirer du vivier' }).click()
    await expect(page.getByText('Cléo Retrait a été retirée du vivier.')).toBeVisible()
    await expect(panel.getByText('Sorties du vivier : 1')).toBeVisible()
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: cleo.registration.id }, select: { status: true } })).status).toBe('withdrawn')
  } finally {
    await prisma.$disconnect()
  }
})

// US-160, US-162 : régler le vivier, le fermer, le rouvrir, copier son lien, ouvrir une session, le supprimer
test('l’équipe règle, ferme, rouvre, copie le lien, ouvre une session et supprime le vivier', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const key = `periode-${Date.now()}`
    const { game, session, period } = await testPeriod(prisma, key)
    await prisma.registrationPeriodSession.update({ where: { sessionId: session.id }, data: { open: false } })

    const panel = await openOwnRegistrations(page, prisma, game.title, 'Réglages')

    // Réglages : le délai de réponse
    await panel.getByRole('button', { name: 'Réglages', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Délai de réponse (jours)').fill('12')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog).toBeHidden()
    await expect(panel.getByText('Délai de réponse : 12 jours')).toBeVisible()
    expect((await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: period.id }, select: { responseDelayDays: true } })).responseDelayDays).toBe(12)

    // Fermeture puis réouverture à la main
    await panel.getByRole('button', { name: 'Fermer' }).click()
    await expect(panel.getByRole('button', { name: 'Ouvrir', exact: true })).toBeVisible()
    expect((await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: period.id }, select: { state: true } })).state).toBe('closed')
    await panel.getByRole('button', { name: 'Ouvrir', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Fermer' })).toBeVisible()
    expect((await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: period.id }, select: { state: true } })).state).toBe('open')

    // Lien de diffusion copié dans le presse-papier
    await panel.getByRole('button', { name: 'Copier le lien' }).click()
    await expect(page.getByText('Lien de diffusion copié.')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/i/${period.publicId}`)

    // Ouvrir la session à la pré-inscription, puis la refermer
    await registrationTab(page, 'Sessions')
    const block = panel.locator(`[data-session="${session.name}"]`)
    await expect(block.getByText('Pas proposée au vivier')).toBeVisible()
    await block.getByRole('button', { name: 'Ouvrir à la pré-inscription' }).click()
    await expect(block.getByText('Ouverte à la pré-inscription')).toBeVisible()
    await block.getByRole('button', { name: 'Refermer' }).click()
    await expect(block.getByText('Pas proposée au vivier')).toBeVisible()

    // Suppression
    await registrationTab(page, 'Réglages')
    page.once('dialog', (dialog) => dialog.accept())
    await panel.getByRole('button', { name: 'Supprimer le vivier' }).click()
    await expect.poll(() => prisma.registrationPeriod.count({ where: { id: period.id } })).toBe(0)
    await expect(panel.getByRole('button', { name: 'Créer le vivier' })).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
