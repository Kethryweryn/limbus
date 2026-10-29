import { expect, test } from '@playwright/test'
import { E2E_USERS } from './constants'
import { expectLoggedIn, login, offlineRecordCount, openUserMenu } from './helpers'

test('un mauvais mot de passe est refusé, le bon connecte', async ({ page }) => {
  await login(page, E2E_USERS.orga, 'mauvais-mot-de-passe')
  await expect(page.getByText('Email ou mot de passe incorrect')).toBeVisible()

  await login(page, E2E_USERS.orga)
  await expectLoggedIn(page)
})

test('la déconnexion efface les données gardées sur l’appareil', async ({ page }) => {
  await login(page, E2E_USERS.orga)
  await expectLoggedIn(page)
  await page.goto('/games')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('offlineAuth'))).not.toBeNull()
  // Les pages visitées sont mises en cache pour le hors ligne
  await expect.poll(() => offlineRecordCount(page)).toBeGreaterThan(0)

  await openUserMenu(page)
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()

  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  expect(await page.evaluate(() => [localStorage.getItem('offlineAuth'), localStorage.getItem('offlineOwner')])).toEqual([null, null])
  expect(await offlineRecordCount(page)).toBe(0)
})

test('à la connexion, les écritures hors ligne d’un autre compte sont effacées', async ({ page }) => {
  await page.goto('/')
  // Simule un appareil où un autre compte a laissé une modification hors ligne en attente
  await page.evaluate(async () => {
    localStorage.setItem('offlineOwner', 'autre-compte')
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('limbus-db')
      request.onupgradeneeded = () => request.result.createObjectStore('syncQueue')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('syncQueue', 'readwrite')
        tx.objectStore('syncQueue').put([{ id: 'op-1', request: '/api/games', method: 'POST', status: 'pending' }], 'operations')
        tx.oncomplete = () => { db.close(); resolve() }
      }
    })
  })

  await login(page, E2E_USERS.autre)
  await expectLoggedIn(page)

  await expect.poll(() => page.evaluate(() => localStorage.getItem('offlineOwner'))).not.toBe('autre-compte')
  const queue = await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open('limbus-db')
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('syncQueue')) { db.close(); resolve(null); return }
      const get = db.transaction('syncQueue').objectStore('syncQueue').get('operations')
      get.onsuccess = () => { db.close(); resolve(get.result ?? null) }
    }
  }))
  expect(queue).toBeNull()
})

test('un refus 403 ne déconnecte pas', async ({ page }) => {
  await login(page, E2E_USERS.orga)
  await expectLoggedIn(page)

  await page.route(/\/api\/games(\?.*)?$/, (route) => route.fulfill({ status: 403, json: { statusCode: 403, message: 'Forbidden' } }))
  await page.goto('/games')
  await page.waitForLoadState('networkidle')

  expect(await page.evaluate(() => localStorage.getItem('offlineAuth'))).not.toBeNull()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeHidden()
})

test('« Déconnecter tous mes appareils » ferme aussi la session des autres navigateurs', async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage()
  const phone = await (await browser.newContext()).newPage()
  await login(laptop, E2E_USERS.partout)
  await login(phone, E2E_USERS.partout)
  await expectLoggedIn(laptop)
  await expectLoggedIn(phone)

  laptop.on('dialog', (dialog) => dialog.accept())
  await openUserMenu(laptop)
  await laptop.getByRole('menuitem', { name: 'Déconnecter tous mes appareils' }).click()
  await expect(laptop.getByRole('heading', { name: 'Connexion' })).toBeVisible()

  await phone.reload()
  await expect(phone.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})
