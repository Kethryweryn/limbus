import { createHash, randomBytes } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { startTestSmtp } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { gamePanel, signIn, slugOf, uniqueName, type TestPrisma } from './helpers'

// Jeu propre au test, avec une session et une période ouverte (sur invitation, sauf entryMode contraire)
async function testPeriod(prisma: TestPrisma, key: string, periodData: { entryMode?: string, state?: string } = {}) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-09-01T09:00:00Z') } })
  const period = await prisma.registrationPeriod.create({
    data: { name: 'Période', gameId: game.id, publicId: `p${Date.now().toString(36)}`, state: 'open', ...periodData, sessions: { create: { sessionId: session.id, seats: 3 } } }
  })
  return { game, session, period }
}

// Personne invitée (email parti) ou confirmée dans la session
async function invitedPerson(prisma: TestPrisma, ids: { gameId: string, sessionId: string, periodId: string }, name: string, status: 'invited' | 'confirmed' = 'invited') {
  const slug = slugOf(uniqueName(name))
  const email = `${slug}@example.test`
  const participant = await prisma.participant.create({ data: { name, slug, email, gameLinks: { create: { gameId: ids.gameId } } } })
  if (status === 'confirmed') await prisma.sessionParticipant.create({ data: { sessionId: ids.sessionId, participantId: participant.id, role: 'participant' } })
  const registration = await prisma.registration.create({
    data: {
      periodId: ids.periodId, sessionId: ids.sessionId, participantId: participant.id, status, source: 'invitation', email,
      tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      invitationSentAt: new Date(), responseDueAt: new Date(Date.now() + 7 * 86_400_000),
      ...(status === 'confirmed' ? { confirmedAt: new Date(), respondedAt: new Date() } : {})
    }
  })
  return { participant, registration, email }
}

async function openRegistrations(page: Page, prisma: TestPrisma) {
  await signIn(page, prisma, E2E_USERS.orga)
  await page.goto('/registrations')
  await page.waitForLoadState('networkidle')
}

// EPIC-001 (US-005) : relance, prolongation, nouveau lien, libération et annulation d'une invitation
test('l’équipe relance, prolonge, renvoie, libère et annule des invitations', async ({ page }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const key = `actions-${Date.now()}`
    const { game, session, period } = await testPeriod(prisma, key)
    const ids = { gameId: game.id, sessionId: session.id, periodId: period.id }
    const ana = await invitedPerson(prisma, ids, 'Ana Actions')
    const ben = await invitedPerson(prisma, ids, 'Ben Actions')

    await openRegistrations(page, prisma)
    const panel = gamePanel(page, game.title, 'Modifier')
    const row = (name: string) => panel.locator('li').filter({ hasText: name })
    await expect(panel.getByText('2 invitations pour 3 places')).toBeVisible()

    // Relance : un email de rappel, et la date de relance sur la ligne
    page.once('dialog', (dialog) => dialog.accept())
    await row('Ana Actions').getByRole('button', { name: 'Relancer' }).click()
    await expect(page.getByText('Rappel envoyé à Ana Actions.')).toBeVisible()
    await expect(row('Ana Actions').getByText(/relancée le/)).toBeVisible()
    await expect.poll(() => smtp.received.filter((message) => message.to.includes(ana.email)).length).toBe(1)

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
    const before = ben.registration.tokenHash
    page.once('dialog', (dialog) => dialog.accept())
    await row('Ben Actions').getByRole('button', { name: 'Nouveau lien' }).click()
    await expect(page.getByText('Nouveau lien envoyé à Ben Actions.')).toBeVisible()
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: ben.registration.id }, select: { tokenHash: true } })).tokenHash).not.toBe(before)
    await expect.poll(() => smtp.received.filter((message) => message.to.includes(ben.email)).length).toBe(1)

    // Libération : la place est libérée par l'organisatrice, la ligne le dit et n'offre plus d'action d'invitation
    page.once('dialog', (dialog) => dialog.accept())
    await row('Ben Actions').getByRole('button', { name: 'Libérer' }).click()
    await expect(page.getByText('Place de Ben Actions libérée.')).toBeVisible()
    await expect(row('Ben Actions').getByText(/place libérée le .* par /)).toBeVisible()
    await expect(row('Ben Actions').getByRole('button', { name: 'Relancer' })).toBeHidden()
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
    await smtp.stop()
    await prisma.$disconnect()
  }
})

// EPIC-001 (US-005) : détail d'une inscription confirmée, puis retrait de la session
test('l’équipe consulte le détail d’une personne confirmée et la retire de la session', async ({ page }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const key = `retrait-${Date.now()}`
    const { game, session, period } = await testPeriod(prisma, key)
    const cleo = await invitedPerson(prisma, { gameId: game.id, sessionId: session.id, periodId: period.id }, 'Cléo Retrait', 'confirmed')

    await openRegistrations(page, prisma)
    const panel = gamePanel(page, game.title, 'Modifier')
    const row = panel.locator('li').filter({ hasText: 'Cléo Retrait' })

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
    await expect(row.getByRole('button', { name: 'Retirer' })).toBeHidden()
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: cleo.participant.id } })).toBe(0)
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: cleo.registration.id }, select: { status: true } })).status).toBe('withdrawn')
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})

// EPIC-001 (US-002, R32) : modifier une période, la clôturer, la rouvrir, copier son lien de diffusion, la supprimer
test('l’équipe modifie, clôture, rouvre, copie le lien et supprime une période', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const key = `periode-${Date.now()}`
    const { game, period } = await testPeriod(prisma, key, { entryMode: 'form' })

    await openRegistrations(page, prisma)
    const panel = gamePanel(page, game.title, 'Modifier')

    // Modification du nom
    await panel.getByRole('button', { name: 'Modifier' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Nom').fill('Période renommée')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog).toBeHidden()
    await expect(panel.getByText('Période renommée')).toBeVisible()
    expect((await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: period.id }, select: { name: true } })).name).toBe('Période renommée')

    // Clôture puis réouverture
    await panel.getByRole('button', { name: 'Clôturer' }).click()
    await expect(panel.getByRole('button', { name: 'Rouvrir' })).toBeVisible()
    expect((await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: period.id }, select: { state: true } })).state).toBe('closed')
    await panel.getByRole('button', { name: 'Rouvrir' }).click()
    await expect(panel.getByRole('button', { name: 'Clôturer' })).toBeVisible()
    expect((await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: period.id }, select: { state: true } })).state).toBe('open')

    // Lien de diffusion copié dans le presse-papier
    await panel.getByRole('button', { name: 'Copier le lien' }).click()
    await expect(page.getByText('Lien de diffusion copié.')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/i/${period.publicId}`)

    // Suppression
    page.once('dialog', (dialog) => dialog.accept())
    await panel.getByRole('button', { name: 'Supprimer' }).click()
    await expect(panel.getByText('Période renommée')).toBeHidden()
    expect(await prisma.registrationPeriod.count({ where: { id: period.id } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})
