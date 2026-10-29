// US-071 et US-073 : un compte qui ne fait que participer arrive sur « Je participe » et y voit sa session
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { parcoursSession, signIn, uniqueName } from './helpers'

test('un compte qui ne fait que participer arrive sur « Je participe »', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const email = `${uniqueName('joueuse').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`
    const user = await prisma.user.create({ data: { email, name: 'Joueuse e2e', password: 'non-utilise' } })
    const { session, game } = await parcoursSession(prisma, 'Session vue par une joueuse')
    await prisma.participant.create({
      data: {
        name: 'Joueuse e2e',
        slug: email.replace(/[^a-z0-9]+/g, '-'),
        email,
        userId: user.id,
        gameLinks: { create: { gameId: game.id } },
        sessionRoles: { create: { sessionId: session.id, role: 'participant' } }
      }
    })

    await signIn(page, prisma, email)
    await expect(page).toHaveURL(/\/participer$/)
    await expect(page.getByRole('heading', { name: 'Je participe' })).toBeVisible()
    await expect(page.getByText(session.name)).toBeVisible()
    // Pas de sélecteur : elle n'organise aucun jeu
    await expect(page.getByRole('link', { name: 'J’organise' })).toBeHidden()
  } finally {
    await prisma.$disconnect()
  }
})

test('qui organise et participe passe d’un espace à l’autre, et retrouve le dernier utilisé', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const email = `${uniqueName('orga-joueuse').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`
    const user = await prisma.user.create({ data: { email, name: 'Orga joueuse e2e', password: 'non-utilise' } })
    const slug = email.replace(/[^a-z0-9]+/g, '-')
    await prisma.game.create({ data: { title: `Jeu de ${slug}`, slug: `jeu-${slug}`, description: '', ownerId: user.id } })
    const { game } = await parcoursSession(prisma, 'Session d’une orga joueuse')
    await prisma.participant.create({ data: { name: 'Orga joueuse e2e', slug, email, userId: user.id, gameLinks: { create: { gameId: game.id } } } })

    // Première ouverture : « J'organise », puisqu'elle a un jeu
    await signIn(page, prisma, email)
    await expect(page).toHaveURL(/\/$/)
    await page.getByRole('link', { name: 'Je participe' }).click()
    await expect(page.getByRole('heading', { name: 'Je participe' })).toBeVisible()

    // Le dernier espace est rouvert
    await page.goto('/')
    await expect(page).toHaveURL(/\/participer$/)
    await page.getByRole('link', { name: 'J’organise' }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
  } finally {
    await prisma.$disconnect()
  }
})
