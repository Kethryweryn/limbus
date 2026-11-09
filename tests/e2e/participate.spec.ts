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

// Cahier de tests, A4 : le choix d'un autre compte ne bloque pas, et « Organiser un GN » laisse un chemin de retour
test('qui ne fait que participer n’est jamais bloquée côté organisation', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const email = `${uniqueName('participante').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`
    const user = await prisma.user.create({ data: { email, name: 'Participante e2e', password: 'non-utilise' } })
    const { session, game } = await parcoursSession(prisma, 'Session d’une participante')
    await prisma.participant.create({
      data: {
        name: 'Participante e2e',
        slug: email.replace(/[^a-z0-9]+/g, '-'),
        email,
        userId: user.id,
        gameLinks: { create: { gameId: game.id } },
        sessionRoles: { create: { sessionId: session.id, role: 'participant' } }
      }
    })

    // Une autre personne a utilisé l'organisation sur ce navigateur
    await page.goto('/nouveautes')
    await page.evaluate(() => localStorage.setItem('limbusSpace', 'autre-compte:organize'))
    await signIn(page, prisma, email)
    await expect(page).toHaveURL(/\/participer$/)
    await expect(page.getByText(session.name)).toBeVisible()
    await expect(page.getByRole('link', { name: 'J’organise' })).toBeHidden()

    // Elle essaie d'organiser, puis revient
    await page.getByRole('link', { name: 'Organiser un GN' }).first().click()
    await expect(page).toHaveURL(/\/games$/)
    await page.getByRole('link', { name: 'Je participe' }).click()
    await expect(page).toHaveURL(/\/participer$/)
    await expect(page.getByText(session.name)).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// Cahier de tests, A3 : un jeu inaccessible montre un message et un chemin de retour
test('un jeu inaccessible affiche un message, et le bouton ramène à l’accueil', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const email = `${uniqueName('sans-acces').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`
    await prisma.user.create({ data: { email, name: 'Sans accès e2e', password: 'non-utilise' } })
    const { game } = await parcoursSession(prisma, 'Session hors de portée')
    const { slug } = await prisma.game.findUniqueOrThrow({ where: { id: game.id }, select: { slug: true } })

    await signIn(page, prisma, email)
    await page.goto(`/games/${slug}`)
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
    await expect(page.getByText('Cette page n’existe pas, ou vous n’y avez pas accès.')).toBeVisible()
    await page.getByRole('button', { name: 'Retour à l’accueil' }).click()
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeHidden()
  } finally {
    await prisma.$disconnect()
  }
})

// Cahier de tests, A3 : une panne ne se fait pas passer pour une page absente
test('une panne au chargement invite à réessayer', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const email = `${uniqueName('panne').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`
    const user = await prisma.user.create({ data: { email, name: 'Panne e2e', password: 'non-utilise' } })
    const slug = email.replace(/[^a-z0-9]+/g, '-')
    await prisma.game.create({ data: { title: `Jeu ${slug}`, slug, description: '', ownerId: user.id } })

    await signIn(page, prisma, email)
    await page.route('**/api/games/slug/**', (route) => route.abort('connectionfailed'))
    await page.goto(`/games/${slug}`)
    await expect(page.getByRole('heading', { name: 'Une erreur est survenue' })).toBeVisible()
    await expect(page.getByText('Réessayez dans un instant.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeHidden()
  } finally {
    await prisma.$disconnect()
  }
})

// Cahier de tests, A1 : le jeu actif se repère à sa carte
test('la carte du jeu actif change de fond', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const email = `${uniqueName('jeu-actif').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`
    const user = await prisma.user.create({ data: { email, name: 'Jeu actif e2e', password: 'non-utilise' } })
    const title = `Jeu ${email}`
    await prisma.game.create({ data: { title, slug: email.replace(/[^a-z0-9]+/g, '-'), description: '', ownerId: user.id } })

    await signIn(page, prisma, email)
    await page.goto('/games')
    await page.waitForLoadState('networkidle')
    const card = page.getByRole('link').filter({ hasText: title }).first()
    const background = () => card.evaluate((element) => getComputedStyle(element).backgroundColor)
    const before = await background()
    await card.getByRole('button', { name: 'Rendre actif' }).click()
    await expect(card.getByText('Jeu actif')).toBeVisible()
    await expect.poll(background).not.toBe(before)
  } finally {
    await prisma.$disconnect()
  }
})

// US-079 : un document reçu se retrouve dans « Je participe » et se lit dans la page
test('un document reçu s’ouvre depuis « Je participe »', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const email = `${uniqueName('lectrice').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`
    const user = await prisma.user.create({ data: { email, name: 'Lectrice e2e', password: 'non-utilise' } })
    const { session, game } = await parcoursSession(prisma, 'Session avec une lettre')
    const participant = await prisma.participant.create({
      data: { name: 'Lectrice e2e', slug: email.replace(/[^a-z0-9]+/g, '-'), email, userId: user.id, gameLinks: { create: { gameId: game.id } }, sessionRoles: { create: { sessionId: session.id, role: 'npc' } } }
    })
    const document = await prisma.document.create({ data: { title: `Lettre ${email}`, slug: `lettre-${participant.slug}`, gameId: game.id, content: 'Brouillon', readyToSend: true } })
    const copyContent = { kind: 'text', title: document.title, subtitle: session.name, sections: [{ title: 'Contenu', body: 'Rendez-vous à la taverne.' }] }
    await prisma.sessionDocumentDelivery.create({
      data: { gameId: session.gameId, sessionId: session.id, participantId: participant.id, documentId: document.id, kind: 'document', copyPdf: Buffer.from('%PDF-1.4'), copyContent, copySize: 100 }
    })

    await signIn(page, prisma, email)
    await expect(page).toHaveURL(/\/participer$/)
    await page.getByRole('link', { name: document.title }).click()
    await expect(page.getByRole('heading', { name: document.title })).toBeVisible()
    await expect(page.getByText('Rendez-vous à la taverne.')).toBeVisible()
    await expect(page.getByText('Brouillon')).toBeHidden()
    await expect(page.getByRole('link', { name: 'PDF' })).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
