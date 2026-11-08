import { expect } from '@playwright/test'
import bcrypt from 'bcrypt'
import { TERMS_VERSION } from '~/utils/legal'
import { createTestPrisma } from '../integration/db'
import { E2E_PASSWORD, E2E_USERS } from './constants'
import { expectLoggedIn, login, offlineRecordCount, openUserMenu, test, uniqueName } from './helpers'

test('un mauvais mot de passe est refusé, le bon connecte', async ({ page }) => {
  await login(page, E2E_USERS.orga, 'mauvais-mot-de-passe')
  await expect(page.getByText('Email ou mot de passe incorrect')).toBeVisible()

  // Le mot de passe s'affiche pendant la saisie, puis se masque de nouveau (US-180)
  const password = page.getByLabel('Mot de passe')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Afficher les caractères' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('mauvais-mot-de-passe')
  await page.getByRole('button', { name: 'Masquer les caractères' }).click()
  await expect(password).toHaveAttribute('type', 'password')

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
  expect(await page.evaluate(() => localStorage.getItem('limbusSpace'))).toBeNull()
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

test('« Déconnecter tous mes appareils » ferme aussi la session des autres navigateurs', async ({ otherPage }) => {
  const laptop = await otherPage()
  const phone = await otherPage()
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

// Un compte par test : l'écran de connexion limite à 10 tentatives par email (ADR-0037)
async function loginAccount() {
  const prisma = createTestPrisma()
  try {
    const email = `${uniqueName('connexion').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`
    await prisma.user.create({ data: { email, name: 'Connexion e2e', password: await bcrypt.hash(E2E_PASSWORD, 4), termsAcceptedVersion: TERMS_VERSION, termsAcceptedAt: new Date() } })
    return email
  } finally {
    await prisma.$disconnect()
  }
}

// Un double clic envoyait deux connexions : le rechargement coupait la seconde, prise pour une panne du serveur
test('un double clic sur « Se connecter » ne bloque pas l’onglet', async ({ page }) => {
  const email = await loginAccount()
  let logins = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/auth/login')) logins++
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).dblclick()
  await expectLoggedIn(page)
  expect(logins).toBe(1)
  expect(await page.evaluate(() => sessionStorage.getItem('limbusServerUnavailable'))).toBeNull()
})

test('à l’ouverture, un onglet marqué hors ligne revérifie le serveur', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => sessionStorage.setItem('limbusServerUnavailable', 'true'))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  await expect(page.getByText('Le serveur ne répond pas.')).toBeHidden()
})

test('après une vraie panne, « Réessayer » rend la connexion sans recharger', async ({ page }) => {
  const email = await loginAccount()
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.route('**/api/auth/login', (route) => route.abort('connectionfailed'))
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByText('Le serveur ne répond pas.')).toBeVisible()

  await page.unroute('**/api/auth/login')
  await page.getByRole('button', { name: 'Réessayer' }).click()
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expectLoggedIn(page)
})
