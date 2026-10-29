// EPIC-010 : déconnexion sans réseau (US-051) et envoi de la file à l'ouverture (US-052)
import { expect, test, type Page } from '@playwright/test'
import { E2E_USERS } from './constants'
import { expectLoggedIn, login, offlineRecordCount, openUserMenu } from './helpers'

// File d'attente de l'appareil, lue ou écrite directement dans IndexedDB
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

async function readQueue(page: Page) {
  return await page.evaluate(() => new Promise<unknown[] | null>((resolve) => {
    const request = indexedDB.open('limbus-db')
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('syncQueue')) { db.close(); resolve(null); return }
      const get = db.transaction('syncQueue').objectStore('syncQueue').get('operations')
      get.onsuccess = () => { db.close(); resolve(get.result ?? null) }
    }
  }))
}

test('sans réseau, la déconnexion efface l’appareil et part au retour du réseau', async ({ page }) => {
  await login(page, E2E_USERS.orga)
  await expectLoggedIn(page)
  await page.goto('/games')
  await expect.poll(() => offlineRecordCount(page)).toBeGreaterThan(0)

  // Le serveur ne répond plus : la déconnexion ne peut pas partir
  await page.route('**/api/auth/logout', (route) => route.abort('internetdisconnected'))
  await openUserMenu(page)
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()

  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  expect(await offlineRecordCount(page)).toBe(0)
  expect(await page.evaluate(() => localStorage.getItem('limbusPendingLogout'))).toBe('true')

  // Retour du réseau : la déconnexion part, la session ne se rouvre pas
  await page.unroute('**/api/auth/logout')
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => page.evaluate(() => localStorage.getItem('limbusPendingLogout'))).toBeNull()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})

test('les modifications en attente partent à l’ouverture de l’application', async ({ page }) => {
  await login(page, E2E_USERS.autre)
  await expectLoggedIn(page)
  const game = await (await page.request.post('/api/games', { data: { title: `Jeu hors ligne ${Date.now()}` } })).json()
  const name = `Clairière ${Date.now()}`

  // Modification laissée en attente lors d'une visite précédente
  await writeQueue(page, [{
    id: 'op-ouverture',
    request: '/api/locations',
    method: 'POST',
    body: { name, gameId: game.id },
    store: 'locations',
    entityId: 'offline-ouverture',
    createdAt: new Date().toISOString(),
    status: 'pending'
  }])

  await page.reload()
  await expect.poll(async () => {
    const locations = await (await page.request.get('/api/locations')).json()
    return locations.some((location: { name: string }) => location.name === name)
  }).toBe(true)
  await expect.poll(() => readQueue(page)).toEqual([])
})
