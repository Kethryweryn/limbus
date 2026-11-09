import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { parcoursSession, signIn, slugOf, testUser, uniqueName } from './helpers'

// EPIC-031 (US-118) : nom et coordonnées depuis « Mon compte »
test('la personne change son nom et ses coordonnées depuis son compte', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { user, email } = await testUser(prisma, 'Compte Nom')

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
    const { user, email, name } = await testUser(prisma, 'Compte Invitation')
    // Jeu d'un autre compte que l'organisatrice des parcours d'inscription, qui ne compte que ses propres invitations
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.autre } })
    const title = uniqueName('Jeu compte')
    const game = await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${title}`, slug: slugOf(`session ${title}`), gameId: game.id, date: new Date('2099-10-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `c${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } } })
    const participant = await prisma.participant.create({ data: { name, slug: slugOf(name), email, userId: user.id, gameLinks: { create: { gameId: game.id } } } })
    const registration = await prisma.registration.create({
      data: {
        gameId: period.gameId, periodId: period.id, invitedSessionId: session.id, participantId: participant.id, status: 'invited', source: 'invitation', email,
        links: { create: { tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex') } }, invitationSentAt: new Date(), responseDueAt: new Date(Date.now() + 7 * 86_400_000)
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
    await page.getByLabel('Prénom', { exact: true }).fill('Compte')
    await page.getByLabel('Nom', { exact: true }).fill('Invitation')
    await page.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    await page.getByLabel('Contact d’urgence : nom', { exact: true }).fill('Dominique')
    await page.getByLabel('Contact d’urgence : téléphone', { exact: true }).fill('0698765432')
    await page.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await page.getByRole('button', { name: 'Envoyer mes réponses' }).click()
    await expect(page.getByText('Vos réponses sont enregistrées.')).toBeVisible()
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, select: { status: true } })).status).toBe('received')
  } finally {
    await prisma.$disconnect()
  }
})

// Cahier de tests, A4-2 (US-177) : le réglage des photos est dans « Mon compte », plus dans « Je participe »
test('« Mes photos » se règle depuis le compte, pour qui a une fiche', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { user, email } = await testUser(prisma, 'Compte Photos')
    await signIn(page, prisma, email)

    // Sans fiche chez une équipe, rien à régler
    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Mon compte', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mes photos' })).toBeHidden()

    const { game } = await parcoursSession(prisma, 'Session des photos du compte')
    await prisma.participant.create({
      data: {
        name: 'Compte Photos',
        slug: email.replace(/[^a-z0-9]+/g, '-'),
        email,
        userId: user.id,
        gameLinks: { create: { gameId: game.id } }
      }
    })

    await page.goto('/participer')
    await expect(page.getByRole('heading', { name: 'Je participe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: game.title })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mes photos' })).toBeHidden()

    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Mes photos' })).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Retirer mes photos' }).click()
    await expect(page.getByText('Vos photos sont retirées.')).toBeVisible()
    await page.getByRole('button', { name: 'Accepter de nouveau une photo' }).click()
    await expect(page.getByText('Les équipes peuvent de nouveau ajouter votre photo.')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
