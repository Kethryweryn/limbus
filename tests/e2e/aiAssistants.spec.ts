// EPIC-033 (US-121, US-123) : la page « Autoriser » d'un assistant d'IA, les assistants connectés du compte, et le
// réglage de la propriétaire dans le partage d'un jeu
import { expect } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { authorizationRequest, captureCallback, signIn, test, uniqueName } from './helpers'

test('l’organisatrice autorise un assistant sur un jeu, le retrouve dans son compte, puis le retire', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = uniqueName('Jeu assistant')
    const game = await prisma.game.create({ data: { title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: '', ownerId: owner.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    // Nom propre au test : rejoué en parallèle, il ne retrouve pas l'assistant d'une autre tentative
    const client = uniqueName('Assistant e2e')
    const location = await authorizationRequest(page, client)
    await page.goto(location)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(`${client} demande à accéder`)).toBeVisible()
    await expect(page.getByText('localhost:9999')).toBeVisible()
    await expect(page.getByText('Cette adresse est sur votre appareil')).toBeVisible()

    await page.getByLabel('Lecture et écriture').check()
    await page.getByLabel(title).check()
    const callback = await captureCallback(page)
    await page.getByRole('button', { name: 'Autoriser' }).click()
    await expect.poll(() => callback.url).toContain('code=')
    // La page suit encore la redirection vers l'assistant : la suivante l'interromprait
    await page.waitForURL(/localhost:9999/)
    expect(new URL(callback.url).searchParams.get('state')).toBe('etat-e2e')

    const authorization = await prisma.aiAuthorization.findFirstOrThrow({
      where: { userId: owner.id, client: { name: client } },
      orderBy: { createdAt: 'desc' },
      include: { games: true }
    })
    expect(authorization.canWrite).toBe(true)
    expect(authorization.games.map((link) => link.gameId)).toEqual([game.id])

    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    const card = page.locator('div.rounded').filter({ hasText: client }).filter({ hasText: title }).first()
    await expect(card.getByText('Lecture et écriture')).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Retirer' }).click()
    await expect.poll(() => prisma.aiAuthorization.count({ where: { id: authorization.id } })).toBe(0)

    await page.getByRole('button', { name: 'Voir le journal des assistants' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: new RegExp(`${client}\\s+·\\s+retiré`) }).first()).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

test('la propriétaire ouvre son jeu aux assistants des co-organisatrices depuis le partage', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = uniqueName('Jeu partagé assistant')
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const game = await prisma.game.create({ data: { title, slug, description: '', ownerId: owner.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    await page.goto(`/games/${slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Partager' }).click()
    const toggle = page.getByRole('switch', { name: 'Les co-organisatrices peuvent y brancher une IA' })
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await expect(toggle).toBeChecked()
    await expect.poll(async () => (await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).aiForCoorganizers).toBe(true)
    await expect(page.getByText('Aucun assistant n’a accès à ce jeu.')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
