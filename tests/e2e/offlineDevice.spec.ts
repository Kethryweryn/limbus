// SPEC-019, EPIC-051 : place prise, effacement et désactivation du hors ligne sur l'appareil (US-223 à US-225),
// sur les quatre axes (ADR-0079) : actions, erreurs de saisie, droits, hors ligne
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { choose, expectLoggedIn, offlineRecordCount, orgaGame, parcoursSession, signIn, test, testUser } from './helpers'

// File d'attente de l'appareil, écrite ou lue directement dans IndexedDB
async function writeQueue(page: Page, operations: unknown[]) {
  await page.evaluate((value) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('limbus-db')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('syncQueue', 'readwrite')
      tx.objectStore('syncQueue').put(value, 'operations')
      tx.oncomplete = () => { db.close(); resolve() }
    }
  }), operations)
}

async function queueLength(page: Page) {
  return await page.evaluate(() => new Promise<number>((resolve) => {
    const request = indexedDB.open('limbus-db')
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('syncQueue')) { db.close(); resolve(0); return }
      const get = db.transaction('syncQueue').objectStore('syncQueue').get('operations')
      get.onsuccess = () => { db.close(); resolve(Array.isArray(get.result) ? get.result.length : 0) }
    }
  }))
}

const registrations = (page: Page) => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)
const card = (page: Page) => page.getByRole('region', { name: 'Hors ligne sur cet appareil' })
const keepBox = (page: Page) => page.getByRole('checkbox', { name: 'Garder Limbus sur cet appareil pour le hors ligne' })

function newLocation(id: string, gameId: string, name: string, status: 'pending' | 'error' = 'pending') {
  return {
    id,
    request: '/api/locations',
    method: 'POST',
    body: { name, gameId },
    store: 'locations',
    entityId: `offline-${id}`,
    createdAt: new Date().toISOString(),
    status,
    ...(status === 'error' ? { error: 'Refusé par le serveur' } : {})
  }
}

async function openAccount(page: Page) {
  await page.goto('/compte')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Hors ligne sur cet appareil' })).toBeVisible()
}

test.describe('place prise et effacement', () => {
  test('la place des données s’affiche, et l’effacement la vide sans déconnecter', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/games')
      await page.waitForLoadState('networkidle')
      await expect.poll(() => offlineRecordCount(page)).toBeGreaterThan(0)
      await openAccount(page)
      await expect(card(page).getByText(/Données gardées \(pages, PDF, photos\) : \d/)).toBeVisible()
      await expect(card(page).getByText(/Place totale réservée à Limbus par le navigateur/)).toBeVisible()

      await card(page).getByRole('button', { name: 'Effacer les données de l’appareil' }).click()
      await card(page).getByRole('button', { name: 'Effacer', exact: true }).click()
      await expect(card(page).getByText('Les données de l’appareil sont effacées.')).toBeVisible()
      expect(await offlineRecordCount(page)).toBe(0)
      // Toujours connectée, et l'identité gardée pour s'ouvrir sans réseau reste (R3)
      expect(await page.evaluate(() => localStorage.getItem('offlineAuth'))).not.toBeNull()
      await page.reload()
      await expectLoggedIn(page)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('les modifications en attente partent avant l’effacement', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu effacement')
      await signIn(page, prisma, E2E_USERS.orga)
      await openAccount(page)
      const name = `Clairière ${Date.now()}`
      await writeQueue(page, [newLocation('op-envoi', game.id, name)])

      await card(page).getByRole('button', { name: 'Effacer les données de l’appareil' }).click()
      await expect(card(page).getByText('1 modification(s) faite(s) sans réseau n’ont pas encore été envoyée(s) :')).toBeVisible()
      await card(page).getByRole('button', { name: 'Les envoyer d’abord' }).click()
      await expect(card(page).getByText('Les données de l’appareil sont effacées.')).toBeVisible()
      expect(await prisma.location.count({ where: { gameId: game.id, name } })).toBe(1)
      expect(await queueLength(page)).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une modification refusée arrête l’effacement ; renoncer la garde, l’abandonner efface', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu refus')
      await signIn(page, prisma, E2E_USERS.orga)
      await openAccount(page)
      await writeQueue(page, [newLocation('op-refus', game.id, 'Lieu refusé', 'error')])

      await card(page).getByRole('button', { name: 'Effacer les données de l’appareil' }).click()
      await card(page).getByRole('button', { name: 'Les envoyer d’abord' }).click()
      await expect(card(page).getByText('Ces modifications n’ont pas pu partir :')).toBeVisible()
      await expect(card(page).getByRole('button', { name: 'Les envoyer d’abord' })).toBeHidden()

      // Renoncer : rien n'est effacé
      await card(page).getByRole('button', { name: 'Annuler' }).click()
      expect(await queueLength(page)).toBe(1)

      await card(page).getByRole('button', { name: 'Effacer les données de l’appareil' }).click()
      await card(page).getByRole('button', { name: 'Les abandonner et effacer' }).click()
      await expect(card(page).getByText('Les données de l’appareil sont effacées.')).toBeVisible()
      expect(await queueLength(page)).toBe(0)
      expect(await prisma.location.count({ where: { gameId: game.id } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('sans réseau, seul l’abandon est proposé, et l’effacement se fait', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu effacement hors ligne')
      await signIn(page, prisma, E2E_USERS.orga)
      await openAccount(page)
      await writeQueue(page, [newLocation('op-hors-ligne', game.id, 'Lieu hors ligne')])
      await context.setOffline(true)

      await card(page).getByRole('button', { name: 'Effacer les données de l’appareil' }).click()
      await expect(card(page).getByRole('button', { name: 'Les envoyer d’abord' })).toBeHidden()
      await card(page).getByRole('button', { name: 'Les abandonner et effacer' }).click()
      await expect(card(page).getByText('Les données de l’appareil sont effacées.')).toBeVisible()
      expect(await queueLength(page)).toBe(0)
      await context.setOffline(false)
      expect(await prisma.location.count({ where: { gameId: game.id } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une participante a aussi la section, pour son appareil', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { email } = await testUser(prisma, 'Participante hors ligne')
      await signIn(page, prisma, email)
      await openAccount(page)
      await expect(card(page).getByRole('button', { name: 'Effacer les données de l’appareil' })).toBeVisible()
      await expect(keepBox(page)).toBeChecked()
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('désactivation', () => {
  test('décocher efface tout, retire l’application, et ne garde plus rien ; recocher la réinscrit', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto('/games')
      await page.waitForLoadState('networkidle')
      await expect.poll(() => registrations(page)).toBeGreaterThan(0)
      await openAccount(page)

      // Renoncer laisse la case cochée
      await keepBox(page).click()
      await card(page).getByRole('button', { name: 'Annuler' }).click()
      await expect(keepBox(page)).toBeChecked()

      await keepBox(page).click()
      await card(page).getByRole('button', { name: 'Désactiver', exact: true }).click()
      await expect(card(page).getByText('Le hors ligne est désactivé sur cet appareil.')).toBeVisible()
      await expect(keepBox(page)).not.toBeChecked()
      await expect(card(page).getByText(/rien n’y est gardé, Limbus ne s’ouvre pas sans réseau/)).toBeVisible()
      await expect.poll(() => registrations(page)).toBe(0)
      expect(await page.evaluate(() => localStorage.getItem('offlineAuth'))).toBeNull()

      // La page a été rechargée : l'application retirée ne garde plus rien pendant la navigation dans Limbus
      await page.getByRole('link', { name: 'Sessions' }).first().click()
      await page.waitForURL('**/sessions')
      await page.waitForLoadState('networkidle')
      expect(await page.evaluate(async () => (await caches.keys()).length)).toBe(0)
      expect(await offlineRecordCount(page)).toBe(0)

      // Plus rien n'est gardé, ni l'application après un rechargement, ni l'identité
      await page.goto('/games')
      await page.waitForLoadState('networkidle')
      expect(await offlineRecordCount(page)).toBe(0)
      expect(await registrations(page)).toBe(0)
      expect(await page.evaluate(() => localStorage.getItem('offlineAuth'))).toBeNull()

      await openAccount(page)
      await keepBox(page).click()
      await expect(card(page).getByText('Le hors ligne est de nouveau actif : les pages consultées sont gardées sur cet appareil.')).toBeVisible()
      await expect.poll(() => registrations(page)).toBeGreaterThan(0)
      await page.goto('/games')
      await page.waitForLoadState('networkidle')
      await expect.poll(() => offlineRecordCount(page)).toBeGreaterThan(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('désactivé, une modification sans réseau échoue sans file, et le réglage survit à un autre compte', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const { session } = await parcoursSession(prisma, 'Session désactivée e2e')
      await signIn(page, prisma, E2E_USERS.orga)
      await openAccount(page)
      await keepBox(page).click()
      await card(page).getByRole('button', { name: 'Désactiver', exact: true }).click()
      await expect(keepBox(page)).not.toBeChecked()

      await page.goto(`/sessions/${session.slug}?tab=cast`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: session.name })).toBeVisible()
      await context.setOffline(true)
      const row = page.locator('form > div.grid').filter({ hasText: 'Aube' })
      await choose(page, row.getByRole('combobox'), /Léa Parcours/)
      await page.getByRole('button', { name: 'Enregistrer le cast' }).click()
      await expect(page.getByText(/Pas de réseau : cette action demande une connexion/)).toBeVisible()
      await expect(page.getByText(/le hors ligne est désactivé sur cet appareil, rien n’y est gardé/)).toBeVisible()
      expect(await queueLength(page)).toBe(0)
      await context.setOffline(false)

      // Un autre compte sur le même appareil : la case reste décochée (R7)
      const { email } = await testUser(prisma, 'Autre compte appareil')
      await signIn(page, prisma, email)
      await openAccount(page)
      await expect(keepBox(page)).not.toBeChecked()
    } finally {
      await prisma.$disconnect()
    }
  })
})
