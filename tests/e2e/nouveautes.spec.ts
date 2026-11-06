// US-147 à US-149 : page « Nouveautés » sans compte, numéro de déploiement et lien du menu
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { signIn, testUser } from './helpers'

test('les nouveautés se lisent sans compte', async ({ page }) => {
  await page.goto('/nouveautes')
  await expect(page.getByRole('heading', { name: 'Nouveautés', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Une page pour suivre les nouveautés' })).toBeVisible()
  await expect(page.getByText(/ · Nouveau$/).first()).toBeVisible()
  // Le lien du menu est réservé aux personnes connectées, et la page ne propose pas de se connecter
  await expect(page.getByRole('button', { name: 'Se connecter' })).toHaveCount(0)
  // La CI, en pull request comme sur main, donne un numéro au build (US-148) ; en local, il n'y en a pas
  const number = page.getByText(/^Déploiement n° \d+$/)
  if (process.env.GITHUB_ACTIONS) await expect(number).toBeVisible()
  else await expect(number).toHaveCount(0)
})

test('le lien du menu, petit et séparé, mène aux nouveautés, sur ordinateur comme sur téléphone', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { email } = await testUser(prisma, 'nouveautes')
    await signIn(page, prisma, email)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const link = page.getByRole('link', { name: 'Nouveautés' })
    await expect(link).toHaveClass(/text-xs/)
    // Replié, le menu ne garde que l'icône et son libellé en info-bulle
    await page.getByRole('button', { name: 'Replier le menu' }).click()
    await expect(link).toHaveAttribute('title', 'Nouveautés')
    await expect(link.getByText('Nouveautés')).toHaveCount(0)
    await page.getByRole('button', { name: 'Déplier le menu' }).click()

    await link.click()
    await expect(page.getByRole('heading', { name: 'Nouveautés', level: 1 })).toBeVisible()

    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.locator('header button').first().click()
    const mobileLink = page.getByRole('dialog').getByRole('link', { name: 'Nouveautés' })
    await expect(mobileLink).toHaveClass(/text-xs/)
    await mobileLink.click()
    await expect(page.getByRole('heading', { name: 'Nouveautés', level: 1 })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  } finally {
    await prisma.$disconnect()
  }
})
