import { expect, type Page } from '@playwright/test'
import { E2E_PASSWORD } from './constants'

export async function login(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto('/')
  // Attendre l'hydratation : avant, le clic soumettrait le formulaire nativement
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

export async function expectLoggedIn(page: Page) {
  await expect(page.locator('header')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeHidden()
}

export async function openUserMenu(page: Page) {
  await page.locator('header [aria-haspopup="menu"]').click()
}

// Nombre d'enregistrements dans la base hors ligne (0 si elle n'existe pas ou a été recréée vide)
export async function offlineRecordCount(page: Page) {
  return await page.evaluate(() => new Promise<number>((resolve) => {
    const request = indexedDB.open('limbus-db')
    request.onsuccess = () => {
      const db = request.result
      const stores = [...db.objectStoreNames]
      if (!stores.length) { db.close(); resolve(0); return }
      const tx = db.transaction(stores)
      let total = 0
      for (const store of stores) {
        const count = tx.objectStore(store).count()
        count.onsuccess = () => { total += count.result }
      }
      tx.oncomplete = () => { db.close(); resolve(total) }
    }
  }))
}
