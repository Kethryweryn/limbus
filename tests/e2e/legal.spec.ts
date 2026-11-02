// US-110, US-111 : pages légales sans compte, et conditions d'utilisation à accepter avant d'entrer
import { expect, test } from '@playwright/test'
import jwt from 'jsonwebtoken'
import { createTestPrisma } from '../integration/db'
import { JWT_SECRET } from '../integration/constants'
import { TERMS_VERSION } from '../../utils/legal'
import { expectLoggedIn } from './helpers'

test('les pages légales s’ouvrent sans compte, depuis l’écran de connexion', async ({ page }) => {
  await page.goto('/')
  // Attendre l'hydratation, sinon le lien n'est pas encore géré par l'application
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Confidentialité' }).click()
  await expect(page.getByRole('heading', { name: 'Politique de confidentialité' })).toBeVisible()
  await page.goto('/mentions-legales')
  await expect(page.getByText('Scaleway SAS')).toBeVisible()
  await page.goto('/conditions')
  await expect(page.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeVisible()
})

test('un compte qui n’a pas accepté la version en cours l’accepte avant d’entrer', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const email = `conditions-${Date.now()}@example.test`
    const user = await prisma.user.create({ data: { email, name: 'Ancienne version', password: 'non-utilise', termsAcceptedVersion: '2000-01-01' } })
    const token = jwt.sign({ id: user.id, v: user.sessionVersion }, JWT_SECRET, { expiresIn: '1h' })
    await page.context().addCookies([{ name: '__Host-limbus_token', value: token, domain: new URL(test.info().project.use.baseURL!).hostname, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'J’accepte' })).toBeVisible()
    await page.getByRole('button', { name: 'J’accepte' }).click()
    await expectLoggedIn(page)
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).termsAcceptedVersion).toBe(TERMS_VERSION)
  } finally {
    await prisma.$disconnect()
  }
})
