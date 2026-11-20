// US-254, US-256 : une nouvelle version est proposée par un bandeau en haut de la page, et ne recharge jamais la page d'elle-même (ADR-0093)
import { expect, type Page } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { markPage, notReloaded, signIn, test } from './helpers'

const banner = (page: Page) => page.getByRole('status', { name: 'Nouvelle version' })

// Page ouverte sous un service worker, avec un repère qu'un rechargement effacerait
async function openControlled(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, { timeout: 20_000 })
  await markPage(page)
}
const controllerUrl = (page: Page) => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '')

/**
 * Un déploiement, propre au contexte du test : le fichier du serveur, partagé par les autres tests, ne change pas. Le
 * service worker est d'abord mis en service sous une autre adresse (/sw.js?version=ancienne), l'« ancienne version » ;
 * au chargement suivant, Limbus inscrit /sw.js, qui est pour le navigateur une nouvelle version : elle s'installe et
 * attend, comme après un vrai déploiement.
 */
async function startOnOldVersion(page: Page) {
  await page.evaluate(async () => {
    const pause = () => new Promise((resolve) => setTimeout(resolve, 200))
    const registration = await navigator.serviceWorker.register('/sw.js?version=ancienne')
    for (let i = 0; i < 100 && !registration.waiting; i++) await pause()
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller?.scriptURL.includes('ancienne'); i++) await pause()
  })
  expect(await controllerUrl(page)).toContain('ancienne')
}

test('une nouvelle version : un bandeau, aucun rechargement au changement de page, « Recharger » et la croix', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    await signIn(page, prisma, E2E_USERS.orga)
    await openControlled(page, '/')
    await startOnOldVersion(page)
    await openControlled(page, '/')
    expect(await controllerUrl(page)).toContain('ancienne')

    // Actions : le bandeau apparaît ; changer de page ne recharge rien
    await expect(banner(page)).toBeVisible({ timeout: 20_000 })
    await expect(banner(page)).toContainText('Une nouvelle version de Limbus est disponible.')
    await page.getByRole('link', { name: 'Personnages' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Personnages' })).toBeVisible()
    await page.waitForTimeout(5_000)
    expect(await notReloaded(page)).toBe(true)
    await expect(banner(page)).toBeVisible()

    // Tout en haut de la page, au-dessus de la barre du logo, dans le flux : il défile avec la page (US-256)
    const placement = await page.evaluate(() => {
      const region = document.querySelector('[aria-label="Nouvelle version"]') as HTMLElement
      const header = document.querySelector('header') as HTMLElement
      return { top: region.getBoundingClientRect().top, bannerBottom: region.getBoundingClientRect().bottom, headerTop: header.getBoundingClientRect().top, position: getComputedStyle(region).position }
    })
    expect(placement.top).toBe(0)
    expect(placement.headerTop).toBeGreaterThanOrEqual(placement.bannerBottom)
    expect(placement.position).toBe('static')

    // La page défile, le bandeau reste collé en haut de l'écran (US-257)
    await page.evaluate(() => {
      document.getElementById('__nuxt')!.style.minHeight = '3000px'
      window.scrollTo(0, 1200)
    })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.querySelector('[aria-label="Nouvelle version"]')!.getBoundingClientRect().top)).toBe(0)
    // Un champ qui prend le focus s'arrête sous le bandeau, pas derrière lui
    const bannerHeight = await page.evaluate(() => document.querySelector('[aria-label="Nouvelle version"]')!.getBoundingClientRect().height)
    expect(bannerHeight).toBeGreaterThan(0)
    await expect.poll(() => page.evaluate(() => parseFloat(document.documentElement.style.scrollPaddingTop))).toBeGreaterThanOrEqual(bannerHeight)
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      document.getElementById('__nuxt')!.style.minHeight = ''
    })

    // Hors ligne : masqué, puis de retour avec le réseau
    await context.setOffline(true)
    await expect(banner(page)).toBeHidden()
    await context.setOffline(false)
    await expect(banner(page)).toBeVisible()

    // La croix le ferme, même après un changement de page ; un chargement complet le rouvre
    await banner(page).getByRole('button', { name: 'Fermer' }).click()
    await expect(banner(page)).toBeHidden()
    await page.getByRole('link', { name: 'Lieux' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Lieux' })).toBeVisible()
    await expect(banner(page)).toBeHidden()
    await openControlled(page, '/locations')
    await expect(banner(page)).toBeVisible({ timeout: 20_000 })

    // « Recharger » charge la nouvelle version : plus rien n'attend, le bandeau a disparu
    await banner(page).getByRole('button', { name: 'Recharger' }).click()
    await expect.poll(() => notReloaded(page).catch(() => true), { timeout: 15_000 }).toBe(false)
    await page.waitForLoadState('networkidle')
    expect(await controllerUrl(page)).toMatch(/\/sw\.js$/)
    await page.waitForTimeout(2_000)
    await expect(banner(page)).toBeHidden()
  } finally {
    await context.setOffline(false)
    await prisma.$disconnect()
  }
})

test('deux onglets : « Recharger » dans l’un ne recharge pas l’autre, qui garde son bandeau', async ({ page, context }) => {
  const prisma = createTestPrisma()
  try {
    await signIn(page, prisma, E2E_USERS.orga)
    await openControlled(page, '/')
    await startOnOldVersion(page)
    await openControlled(page, '/')
    const other = await context.newPage()
    await openControlled(other, '/characters')
    await expect(banner(page)).toBeVisible({ timeout: 20_000 })
    await expect(banner(other)).toBeVisible({ timeout: 20_000 })

    await banner(page).getByRole('button', { name: 'Recharger' }).click()
    await expect.poll(() => notReloaded(page).catch(() => true), { timeout: 15_000 }).toBe(false)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2_000)
    await expect(banner(page)).toBeHidden()

    // L'autre onglet n'a pas bougé, et garde son bandeau ; « Recharger » y recharge aussitôt
    await other.waitForTimeout(5_000)
    expect(await notReloaded(other)).toBe(true)
    await expect(banner(other)).toBeVisible()
    await banner(other).getByRole('button', { name: 'Recharger' }).click()
    await expect.poll(() => notReloaded(other).catch(() => true), { timeout: 5_000 }).toBe(false)
    await other.waitForLoadState('networkidle')
    await expect(banner(other)).toBeHidden()
  } finally {
    await prisma.$disconnect()
  }
})
