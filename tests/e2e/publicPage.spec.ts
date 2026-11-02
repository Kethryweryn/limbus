import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { slugOf, uniqueName } from './helpers'

test('un teaser YouTube ne charge le lecteur qu’au clic (US-046)', async ({ page }) => {
  const youtubeRequests: string[] = []
  page.on('request', (request) => {
    if (/youtube|ytimg|googlevideo/.test(new URL(request.url()).hostname)) youtubeRequests.push(request.url())
  })
  await page.goto('/public/games/jeu-teaser')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(youtubeRequests).toEqual([])

  await page.getByRole('button', { name: 'Lire la vidéo (YouTube)' }).click()
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')
})

test('un teaser javascript: n’est ni intégré ni proposé en lien', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss() })

  await page.goto('/public/games/jeu-piege')
  await expect(page.getByRole('heading', { name: 'Jeu piégé' })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByText('Voir le teaser')).toHaveCount(0)
  expect(dialogs).toEqual([])
})

// EPIC-031 (US-118) : l'ancienne adresse d'un jeu renommé mène à la nouvelle, qui montre ses sessions et son lien d'inscription
test('la page publique suit un renommage et montre sessions et inscription', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = uniqueName('Jeu public')
    const game = await prisma.game.create({
      data: { title, slug: slugOf(title), description: '', ownerId: owner.id, publicPage: true, publicShowSessions: true, publicShowRegistration: true, slugRedirects: { create: { slug: `ancien-${slugOf(title)}` } } }
    })
    const session = await prisma.session.create({ data: { name: `Session ${title}`, slug: slugOf(`session ${title}`), gameId: game.id, published: true, date: new Date('2099-11-01T09:00:00Z') } })
    await prisma.registrationPeriod.create({ data: { name: 'Hiver', gameId: game.id, publicId: `g${Date.now().toString(36)}`, entryMode: 'form', state: 'open', sessions: { create: { sessionId: session.id, seats: 3 } } } })

    await page.goto(`/public/games/ancien-${slugOf(title)}`)
    await expect(page).toHaveURL(new RegExp(`/public/games/${game.slug}$`))
    await expect(page.getByRole('heading', { name: 'Prochaines sessions' })).toBeVisible()
    await expect(page.getByText(session.name)).toBeVisible()
    await expect(page.getByRole('link', { name: 'S’inscrire : Hiver' })).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-031 (US-118) : la personne confirme sa présence par son lien personnel (US-024)
test('une personne confirme sa présence par son lien', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = uniqueName('Jeu présence')
    const game = await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${title}`, slug: slugOf(`session ${title}`), gameId: game.id, date: new Date('2099-12-01T09:00:00Z') } })
    const name = uniqueName('Paul Présence')
    const participant = await prisma.participant.create({ data: { name, slug: slugOf(name), email: `${slugOf(name)}@example.test`, gameLinks: { create: { gameId: game.id } } } })
    const token = randomBytes(32).toString('base64url')
    const attendance = await prisma.sessionAttendance.create({
      data: { sessionId: session.id, participantId: participant.id, tokenHash: createHash('sha256').update(token).digest('hex'), responseDueAt: new Date(Date.now() + 7 * 86_400_000) }
    })

    await page.goto(`/presence/${token}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await page.getByRole('button', { name: 'Je viens' }).click()
    await expect(page.getByText('Votre réponse : je viens')).toBeVisible()
    expect((await prisma.sessionAttendance.findUniqueOrThrow({ where: { id: attendance.id }, select: { status: true } })).status).toBe('confirmed')
  } finally {
    await prisma.$disconnect()
  }
})
