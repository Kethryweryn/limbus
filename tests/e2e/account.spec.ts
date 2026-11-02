import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { TERMS_VERSION } from '../../utils/legal'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { signIn, slugOf, uniqueName, type TestPrisma } from './helpers'

// Compte propre au test : ses changements ne touchent pas les comptes partagés
async function testAccount(prisma: TestPrisma, base: string) {
  const name = uniqueName(base)
  const email = `${slugOf(name)}@example.test`
  const user = await prisma.user.create({ data: { email, name, password: 'inutilisable', termsAcceptedVersion: TERMS_VERSION, emailConfirmedAt: new Date() } })
  return { user, email, name }
}

// EPIC-031 (US-118) : nom et coordonnées depuis « Mon compte »
test('la personne change son nom et ses coordonnées depuis son compte', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { user, email } = await testAccount(prisma, 'Compte Nom')

    await signIn(page, prisma, email)
    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(`Adresse actuelle : ${email}`)).toBeVisible()

    const name = uniqueName('Nouveau Nom')
    await page.getByLabel('Nom', { exact: true }).fill(name)
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await expect(page.getByText('Nom enregistré.')).toBeVisible()

    await page.getByLabel('Téléphone', { exact: true }).fill('0611223344')
    await page.getByLabel('Contact d’urgence : nom').fill('Camille')
    await page.getByRole('button', { name: 'Enregistrer mes coordonnées' }).click()
    await expect(page.getByText('Coordonnées enregistrées : vos fiches et inscriptions sont à jour.')).toBeVisible()

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, phone: true, emergencyContactName: true } })
    expect(saved).toEqual({ name, phone: '0611223344', emergencyContactName: 'Camille' })
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-031 (US-118) : une invitation se reçoit dans « Je participe » et s'accepte depuis le compte (US-072)
test('la personne accepte une invitation depuis « Je participe »', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { user, email, name } = await testAccount(prisma, 'Compte Invitation')
    // Jeu d'un autre compte que l'organisatrice des parcours d'inscription, qui ne compte que ses propres invitations
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.autre } })
    const title = uniqueName('Jeu compte')
    const game = await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${title}`, slug: slugOf(`session ${title}`), gameId: game.id, date: new Date('2099-10-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { name: 'Période', gameId: game.id, publicId: `c${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, seats: 3 } } } })
    const participant = await prisma.participant.create({ data: { name, slug: slugOf(name), email, userId: user.id, gameLinks: { create: { gameId: game.id } } } })
    const registration = await prisma.registration.create({
      data: {
        periodId: period.id, sessionId: session.id, participantId: participant.id, status: 'invited', source: 'invitation', email,
        tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'), invitationSentAt: new Date(), responseDueAt: new Date(Date.now() + 7 * 86_400_000)
      }
    })

    await signIn(page, prisma, email)
    await page.goto('/participer')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await page.getByRole('link', { name: 'Répondre' }).click()
    await expect(page).toHaveURL(new RegExp(`/participer/inscriptions/${registration.id}$`))
    await page.waitForLoadState('networkidle')

    // Champs demandés par le formulaire par défaut, que le compte ne tient pas encore
    for (const [label, value] of [['Prénom', 'Compte'], ['Nom', 'Invitation'], ['Téléphone', '0612345678'], ['Contact d’urgence : nom', 'Dominique'], ['Contact d’urgence : téléphone', '0698765432']]) {
      const field = page.getByLabel(label!, { exact: true })
      if (await field.isEditable()) await field.fill(value!)
    }
    await page.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await page.getByRole('button', { name: 'Accepter l’invitation' }).click()
    await expect(page.getByText('Votre inscription est confirmée.')).toBeVisible()
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, select: { status: true } })).status).toBe('confirmed')
  } finally {
    await prisma.$disconnect()
  }
})
