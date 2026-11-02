// EPIC-033 (US-121, US-123) : la page « Autoriser » d'un assistant d'IA, les assistants connectés du compte, et le
// réglage de la propriétaire dans le partage d'un jeu
import { createHash } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { signIn, test, uniqueName } from './helpers'

const REDIRECT = 'http://localhost:9999/callback'

// Demande d'autorisation d'un assistant inscrit dynamiquement : l'adresse de la page « Autoriser »
async function authorizationRequest(page: Page) {
  const client = await (await page.request.post('/oauth/register', {
    data: { client_name: 'Assistant e2e', redirect_uris: [REDIRECT] }
  })).json()
  const challenge = createHash('sha256').update('v'.repeat(50)).digest('base64url')
  const response = await page.request.get(`/oauth/authorize?${new URLSearchParams({
    response_type: 'code', client_id: client.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 'etat-e2e'
  })}`, { maxRedirects: 0 })
  return response.headers().location!
}

test('l’organisatrice autorise un assistant sur un jeu, le retrouve dans son compte, puis le retire', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = uniqueName('Jeu assistant')
    const game = await prisma.game.create({ data: { title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: '', ownerId: owner.id } })
    await signIn(page, prisma, E2E_USERS.orga)

    const location = await authorizationRequest(page)
    await page.goto(location)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Assistant e2e demande à accéder')).toBeVisible()
    await expect(page.getByText('localhost:9999')).toBeVisible()
    await expect(page.getByText('Cette adresse est sur votre appareil')).toBeVisible()

    await page.getByLabel('Lecture et écriture').check()
    await page.getByLabel(title).check()
    // L'adresse de retour de l'assistant n'existe pas ici : on la capte
    let callback = ''
    await page.route(`${REDIRECT}**`, (route) => {
      callback = route.request().url()
      return route.fulfill({ body: 'ok' })
    })
    await page.getByRole('button', { name: 'Autoriser' }).click()
    await expect.poll(() => callback).toContain('code=')
    expect(new URL(callback).searchParams.get('state')).toBe('etat-e2e')

    const authorization = await prisma.aiAuthorization.findFirstOrThrow({
      where: { userId: owner.id, client: { name: 'Assistant e2e' } },
      orderBy: { createdAt: 'desc' },
      include: { games: true }
    })
    expect(authorization.canWrite).toBe(true)
    expect(authorization.games.map((link) => link.gameId)).toEqual([game.id])

    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    const card = page.locator('div.rounded').filter({ hasText: 'Assistant e2e' }).filter({ hasText: title }).first()
    await expect(card.getByText('Lecture et écriture')).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Retirer' }).click()
    await expect.poll(() => prisma.aiAuthorization.count({ where: { id: authorization.id } })).toBe(0)

    await page.getByRole('button', { name: 'Voir le journal des assistants' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: /Assistant e2e\s+·\s+retiré/ }).first()).toBeVisible()
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
