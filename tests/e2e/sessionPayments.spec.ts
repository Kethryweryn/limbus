// US-199 : paiements et présence d'une session (SPEC-006 R14 à R18 ; SPEC-004 R16, R18 à R20)
import { inSentence, withGame } from '../../utils/sessionLabels'
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { blockWith, choose, gameCharacter, gamePerson, orgaGame, orgaSession, signIn, test, type TestPrisma } from './helpers'

const DAY_MS = 24 * 60 * 60 * 1000

// Session d'un jeu propre au test, où chaque personne, avec une adresse propre au test, joue un PJ
async function paidSession(prisma: TestPrisma, base: string, people: string[]) {
  const game = await orgaGame(prisma, `Jeu ${base}`)
  const session = await orgaSession(prisma, game.id, base)
  const cast = await Promise.all(people.map(async (who) => ({
    participant: await gamePerson(prisma, game.id, who, ''),
    character: await gameCharacter(prisma, game.id, `Rôle de ${who}`)
  })))
  await prisma.sessionParticipant.createMany({ data: cast.map(({ participant }) => ({ sessionId: session.id, participantId: participant.id, role: 'participant' as const })) })
  await prisma.sessionAssignment.createMany({ data: cast.map(({ participant, character }) => ({ gameId: game.id, sessionId: session.id, characterId: character.id, participantId: participant.id })) })
  return { game, session, cast }
}

async function openTab(page: Page, session: { slug: string, label: string }, tab: string) {
  await page.goto(`/sessions/${session.slug}?tab=${tab}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { level: 1, name: session.label })).toBeVisible()
}

const row = (page: Page, name: string) => page.locator('article').filter({ hasText: name })

test('paiement simple : valider puis annuler, demande puis relance, et le paiement d’une personne partie se décide (R15, R16, R18)', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const { game, session, cast } = await paidSession(prisma, 'Session au paiement simple', ['Léa payeuse', 'Noé parti'])
    const [lea, noe] = cast.map((line) => line.participant)
    await signIn(page, prisma, E2E_USERS.orga)
    await openTab(page, session, 'payments')

    // Valider puis annuler un paiement (R15)
    await row(page, lea!.name).getByRole('button', { name: 'Valider le paiement' }).click()
    await expect(row(page, lea!.name).getByRole('button', { name: 'Annuler le paiement' })).toBeVisible()
    await expect.poll(async () => Boolean((await prisma.sessionPayment.findFirst({ where: { sessionId: session.id, participantId: lea!.id } }))?.paidAt)).toBe(true)
    await row(page, lea!.name).getByRole('button', { name: 'Annuler le paiement' }).click()
    await expect(row(page, lea!.name).getByRole('button', { name: 'Valider le paiement' })).toBeVisible()

    // Première demande « Paiement », puis « Relance paiement » (R18)
    await row(page, lea!.name).getByRole('button', { name: 'Envoyer' }).click()
    await expect.poll(() => mailbox.to(lea!.email!).length).toBe(1)
    // Hors des pages du jeu, l'objet porte le jeu devant le libellé (SPEC-021, R4)
    expect(mailbox.to(lea!.email!)[0]!.subject).toBe(`Paiement - ${withGame(game.title, session.label)}`)
    expect(mailbox.to(lea!.email!)[0]!.text).toContain(`participation à la ${inSentence(session.label)}`)
    // Ligne au bas de l'email (US-247) : Léa n'a pas activé de compte, le lien mène à la page d'activation
    const footer = /Retrouvez tout cela dans votre compte Limbus, en l’activant avec cette adresse : (\S+)/.exec(mailbox.to(lea!.email!)[0]!.text)
    expect(footer?.[1]).toMatch(/\/acces\/activer$/)
    const activation = await page.context().newPage()
    await activation.goto(new URL(footer![1]!).pathname)
    await expect(activation.getByRole('heading', { name: 'Activer mon compte' })).toBeVisible()
    await activation.close()
    await expect(row(page, lea!.name).getByRole('button', { name: 'Relancer' })).toBeVisible()
    await row(page, lea!.name).getByRole('button', { name: 'Relancer' }).click()
    await expect.poll(() => mailbox.to(lea!.email!).length).toBe(2)
    expect(mailbox.to(lea!.email!)[1]!.subject).toBe(`Relance paiement - ${withGame(game.title, session.label)}`)

    // Noé a payé puis quitte la session : son paiement reste à décider, et « À décider » redevient un choix (R16, US-205)
    await row(page, noe!.name).getByRole('button', { name: 'Valider le paiement' }).click()
    await expect(row(page, noe!.name).getByRole('button', { name: 'Annuler le paiement' })).toBeVisible()
    await prisma.sessionAssignment.updateMany({ where: { sessionId: session.id, participantId: noe!.id }, data: { participantId: null } })
    await prisma.sessionParticipant.deleteMany({ where: { sessionId: session.id, participantId: noe!.id } })
    await page.reload()
    await page.waitForLoadState('networkidle')
    const departures = page.locator('section').filter({ hasText: 'Paiements de personnes parties' })
    const departure = departures.locator('article').filter({ hasText: noe!.name })
    await expect(departure).toBeVisible()
    await choose(page, departure.getByRole('combobox').first(), /^Remboursé$/)
    await expect.poll(async () => (await prisma.sessionPayment.findFirstOrThrow({ where: { sessionId: session.id, participantId: noe!.id } })).refundStatus).toBe('refunded')
    await choose(page, departure.getByRole('combobox').first(), 'À décider')
    await expect.poll(async () => (await prisma.sessionPayment.findFirstOrThrow({ where: { sessionId: session.id, participantId: noe!.id } })).refundStatus).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

test('tarifs : un tarif de soutien sur un tarif de base, choisi pour une personne, puis rendu au tarif de son rôle (R15b, R15d)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { session, cast } = await paidSession(prisma, 'Session aux tarifs', ['Léa soutien'])
    const lea = cast[0]!.participant
    await signIn(page, prisma, E2E_USERS.orga)
    await openTab(page, session, 'payments')
    const tariffForm = page.locator('form').filter({ has: page.getByPlaceholder('PJ, PNJ, réduit, soutien…') })

    // Tarif PJ de 50 €, par défaut pour les PJ
    await tariffForm.getByPlaceholder('PJ, PNJ, réduit, soutien…').fill('PJ')
    await tariffForm.getByLabel('Montant (€)').fill('50')
    await choose(page, tariffForm.getByLabel('Par défaut pour'), /^PJ$/)
    await tariffForm.getByRole('button', { name: 'Ajouter' }).click()
    await expect(row(page, lea.name).getByText('Dû 50,00')).toBeVisible()

    // Tarif de soutien à 80 €, sur la base du tarif PJ : une place solidaire
    await tariffForm.getByPlaceholder('PJ, PNJ, réduit, soutien…').fill('Soutien')
    await tariffForm.getByLabel('Montant (€)').fill('80')
    await choose(page, tariffForm.getByLabel('Tarif de base (solidaire)'), /^PJ/)
    await tariffForm.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('heading', { name: 'Places solidaires' })).toBeVisible()

    // Léa choisit le soutien, puis revient au tarif de son rôle (US-205)
    await choose(page, row(page, lea.name).getByRole('combobox').first(), /^Soutien/)
    await expect(row(page, lea.name).getByText('Dû 80,00')).toBeVisible()
    await choose(page, row(page, lea.name).getByRole('combobox').first(), /^Tarif du rôle/)
    await expect(row(page, lea.name).getByText('Dû 50,00')).toBeVisible()
    await expect.poll(async () => (await prisma.sessionPayment.findFirstOrThrow({ where: { sessionId: session.id, participantId: lea.id } })).tariffId).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

test('présence : une réponse en retard est signalée, et libérer la place retire la personne de l’équipe et du casting (R19, R20)', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { game, session, cast } = await paidSession(prisma, 'Session de remplacement', ['Léa en retard', 'Noé qui vient'])
    const [late, coming] = cast
    const original = await orgaSession(prisma, game.id, 'Session reportée', { status: 'postponed' })
    await prisma.session.update({ where: { id: original.id }, data: { postponedToSessionId: session.id } })
    const yesterday = new Date(Date.now() - DAY_MS)
    await prisma.sessionAttendance.createMany({ data: [
      { sessionId: session.id, participantId: late!.participant.id, status: 'pending', responseDueAt: yesterday, invitationSentAt: new Date(Date.now() - 5 * DAY_MS) },
      { sessionId: session.id, participantId: coming!.participant.id, status: 'confirmed', responseDueAt: yesterday, respondedAt: new Date() }
    ] })
    await signIn(page, prisma, E2E_USERS.orga)
    await openTab(page, session, 'presence')

    const lateRow = blockWith(page, page.getByText(late!.participant.name, { exact: true }), 'Libérer la place')
    await expect(lateRow.getByText('Délai dépassé')).toBeVisible()
    // Rien ne change tout seul (R19) : la personne est encore dans l'équipe et le casting
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: late!.participant.id } })).toBe(1)

    page.once('dialog', (dialog) => dialog.accept())
    await lateRow.getByRole('button', { name: 'Libérer la place' }).click()
    await expect.poll(() => prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: late!.participant.id } })).toBe(0)
    expect(await prisma.sessionAssignment.findFirstOrThrow({ where: { sessionId: session.id, characterId: late!.character.id }, select: { participantId: true } })).toEqual({ participantId: null })
    // Noé, qui a confirmé, reste
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: coming!.participant.id } })).toBe(1)
  } finally {
    await prisma.$disconnect()
  }
})

// Réglages des paiements : date limite, lien et RIB, gardés à l'enregistrement (SessionPaymentSettings)
test('réglages : date limite, lien et RIB s’enregistrent, un lien invalide est refusé', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { session } = await paidSession(prisma, 'Session aux réglages de paiement', ['Léa réglée'])
    await signIn(page, prisma, E2E_USERS.orga)
    await openTab(page, session, 'payments')
    const saved = () => prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { paymentLinkUrl: true, paymentRibUrl: true, withdrawalDeadline: true } })

    // Erreur de saisie : un lien qui n'est pas http(s) est refusé, rien n'est enregistré
    await page.getByLabel('Lien de paiement').fill('javascript:alert(1)')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByText('Le lien doit commencer par https:// (ou http://)')).toBeVisible()
    expect((await saved()).paymentLinkUrl).toBeNull()

    await page.getByLabel('Date limite de désistement').fill('2099-05-01')
    await page.getByLabel('Lien de paiement').fill('https://paiement.example.test/session')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect.poll(async () => (await saved()).paymentLinkUrl).toBe('https://paiement.example.test/session')
    expect((await saved()).withdrawalDeadline?.toISOString().slice(0, 10)).toBe('2099-05-01')

    // Un RIB dont l'enregistrement est refusé n'est pas affiché comme posé
    const rib = { name: 'rib.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') }
    await page.route('**/payments/settings', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, message: 'Modifié entre-temps' }) }))
    await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(rib)
    await expect(page.getByText('Modifié entre-temps')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Téléverser un RIB' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voir le PDF' })).toHaveCount(0)
    await page.unroute('**/payments/settings')

    // Le RIB téléversé s'enregistre aussitôt, puis se retire
    await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(rib)
    await expect(page.getByRole('link', { name: 'Voir le PDF' })).toBeVisible()
    await expect.poll(async () => (await saved()).paymentRibUrl).toBeTruthy()
    await page.getByRole('button', { name: 'Retirer', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Téléverser un RIB' })).toBeVisible()
    await expect.poll(async () => (await saved()).paymentRibUrl).toBeNull()
    // Le lien et la date restent
    expect((await saved()).paymentLinkUrl).toBe('https://paiement.example.test/session')

    await page.reload()
    await expect(page.getByLabel('Lien de paiement')).toHaveValue('https://paiement.example.test/session')
    await expect(page.getByLabel('Date limite de désistement')).toHaveValue('2099-05-01')
  } finally {
    await prisma.$disconnect()
  }
})
