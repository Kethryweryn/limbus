// SPEC-019, EPIC-053 : une participante télécharge ses sessions à venir (US-229), sur les quatre axes (ADR-0079) :
// actions, erreurs de saisie, droits, hors ligne
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { orgaGame, orgaSession, signIn, slugOf, test, testUser, uniqueName, type TestPrisma } from './helpers'
import { withFicheValues } from '../fiche'

// Personne au compte confirmé, avec sa fiche dans un jeu, et un document reçu pour une session à venir et une passée
async function member(prisma: TestPrisma, base: string) {
  const game = await orgaGame(prisma, base)
  const upcoming = await orgaSession(prisma, game.id, `À venir ${base}`, { date: new Date('2099-05-15T09:00:00Z') })
  const past = await orgaSession(prisma, game.id, `Passée ${base}`, { date: new Date('2020-05-15T09:00:00Z'), status: 'completed' })
  const { user, email, name } = await testUser(prisma, `Joueuse ${base}`)
  const participant = await withFicheValues(prisma.participant.create({ data: { slug: slugOf(name), email, userId: user.id, gameLinks: { create: { gameId: game.id , name: name } } } }), { name: name })
  const delivery = async (session: { id: string, label: string }) => {
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
    const title = uniqueName('Lettre')
    const document = await prisma.document.create({ data: { title, slug: slugOf(title), gameId: game.id, content: 'Brouillon', readyToSend: true } })
    const created = await prisma.sessionDocumentDelivery.create({
      data: {
        gameId: game.id, sessionId: session.id, participantId: participant.id, documentId: document.id, kind: 'document',
        copyPdf: Buffer.from('%PDF-1.4'), copyContent: { kind: 'text', title, subtitle: session.label, sections: [{ title: 'Contenu', body: `Texte de ${title}` }] }, copySize: 100
      }
    })
    return { id: created.id, title }
  }
  return { game, upcoming, past, email, participant, next: await delivery(upcoming), old: await delivery(past) }
}

const card = (page: Page) => page.getByRole('region', { name: 'Hors ligne sur cet appareil' })
const row = (page: Page) => card(page).getByRole('listitem', { name: 'Mes sessions à venir' })

async function storedKeys(page: Page) {
  return await page.evaluate(() => new Promise<string[]>((resolve) => {
    const request = indexedDB.open('limbus-db')
    request.onsuccess = () => {
      const db = request.result
      const keys = db.transaction('responses').objectStore('responses').getAllKeys()
      keys.onsuccess = () => { db.close(); resolve(keys.result.map(String)) }
    }
  }))
}

async function downloadMine(page: Page) {
  await page.goto('/compte')
  await page.waitForLoadState('networkidle')
  await row(page).getByRole('button', { name: /^Télécharger/ }).click()
  await expect(card(page).getByText('Vos sessions à venir sont téléchargées : « Je participe » et vos documents s’ouvrent sans réseau sur cet appareil.')).toBeVisible({ timeout: 30000 })
}

test.describe('télécharger mes sessions à venir', () => {
  test('sans réseau, « Je participe » et les documents des sessions à venir s’ouvrent ; ceux des sessions passées ne sont pas gardés', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const mine = await member(prisma, 'Sessions téléchargées')
      await signIn(page, prisma, mine.email)
      await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBeGreaterThan(0)
      await downloadMine(page)
      expect(await storedKeys(page)).not.toContain(`/api/me/documents/${mine.old.id}`)

      await context.setOffline(true)
      await page.getByRole('link', { name: 'Je participe', exact: true }).first().click()
      await expect(page.getByText(mine.upcoming.label).first()).toBeVisible()
      await page.getByRole('link', { name: mine.next.title }).first().click()
      await expect(page.getByText(`Texte de ${mine.next.title}`)).toBeVisible()
      const pdf = await page.evaluate(async (id) => (await fetch(`/api/me/documents/${id}/pdf`)).status, mine.next.id)
      expect(pdf).toBe(200)
      await context.setOffline(false)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une session que « Je participe » ne montre plus part de l’appareil à la mise à jour', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const mine = await member(prisma, 'Session retirée')
      await signIn(page, prisma, mine.email)
      await downloadMine(page)
      expect(await storedKeys(page)).toContain(`/api/me/documents/${mine.next.id}`)

      // Retirée de la session, et son document avec ; le téléchargement date de deux heures
      await prisma.sessionDocumentDelivery.deleteMany({ where: { id: mine.next.id } })
      await prisma.sessionParticipant.deleteMany({ where: { sessionId: mine.upcoming.id, participantId: mine.participant.id } })
      await page.evaluate(() => new Promise<void>((resolve) => {
        const request = indexedDB.open('limbus-db')
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('offlineDownloads', 'readwrite')
          const store = tx.objectStore('offlineDownloads')
          const get = store.get('mes-sessions')
          get.onsuccess = () => store.put({ ...get.result, date: new Date(Date.now() - 2 * 3600 * 1000).toISOString() }, 'mes-sessions')
          tx.oncomplete = () => { db.close(); resolve() }
        }
      }))
      const finished = page.evaluate(() => new Promise<void>((resolve) => window.addEventListener('limbus:offline-downloads', () => resolve(), { once: true })))
      await page.evaluate(() => window.dispatchEvent(new Event('online')))
      await finished
      expect(await storedKeys(page)).not.toContain(`/api/me/documents/${mine.next.id}`)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('un PNJ sans accès au jeu a ce bouton et pas celui du jeu ; une personne sans session n’en a aucun', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu du PNJ')
      const session = await orgaSession(prisma, game.id, 'Session du PNJ', { date: new Date('2099-06-01T09:00:00Z') })
      const pnj = await testUser(prisma, 'PNJ téléchargement')
      const participant = await withFicheValues(prisma.participant.create({ data: { slug: slugOf(pnj.name), email: pnj.email, userId: pnj.user.id, gameLinks: { create: { gameId: game.id , name: pnj.name } } } }), { name: pnj.name })
      await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'npc' } })
      await signIn(page, prisma, pnj.email)
      await page.goto('/compte')
      await page.waitForLoadState('networkidle')
      await expect(row(page).getByRole('button', { name: 'Télécharger mes sessions à venir' })).toBeVisible()
      await expect(card(page).getByRole('listitem', { name: game.title })).toHaveCount(0)

      const nobody = await testUser(prisma, 'Sans session téléchargement')
      await signIn(page, prisma, nobody.email)
      await page.goto('/compte')
      await page.waitForLoadState('networkidle')
      await expect(card(page).getByRole('heading', { name: 'Télécharger pour le hors ligne' })).toHaveCount(0)
    } finally {
      await prisma.$disconnect()
    }
  })
})
