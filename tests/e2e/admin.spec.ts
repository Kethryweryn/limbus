import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { startTestSmtp } from '../integration/smtp'
import { signIn, slugOf, testUser, uniqueName } from './helpers'

// EPIC-031 (US-118) : l'administratrice crée un compte, le désactive, et teste l'envoi d'emails
test('l’administratrice crée et désactive un compte, puis teste l’envoi d’emails', async ({ page }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const { email: adminEmail } = await testUser(prisma, 'Admin', 'admin')
    const name = uniqueName('Compte Créé')
    const email = `${slugOf(name)}@example.test`

    await signIn(page, prisma, adminEmail)
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    const creation = page.locator('form').filter({ has: page.getByRole('button', { name: 'Créer' }) })
    await creation.getByLabel('Nom').fill(name)
    await creation.getByLabel('Email').fill(email)
    await creation.getByRole('button', { name: 'Créer' }).click()
    await expect(page.getByText(`Compte créé : ${email} a reçu un lien pour choisir son mot de passe.`)).toBeVisible()
    await expect.poll(() => smtp.received.filter((message) => message.to.includes(email)).length).toBe(1)

    // Désactivation depuis la carte du compte
    const card = page.locator('div').filter({ has: page.getByRole('heading', { name, exact: true }) }).filter({ has: page.getByRole('button', { name: 'Désactiver' }) }).last()
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Désactiver' }).click()
    await expect(card.getByText('Désactivé', { exact: true })).toBeVisible()
    expect((await prisma.user.findUniqueOrThrow({ where: { email }, select: { disabledAt: true } })).disabledAt).not.toBeNull()

    // Configuration SMTP : lue, puis un email de test part
    await page.goto('/admin/smtp')
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('Serveur SMTP')).toHaveValue('127.0.0.1')
    await page.getByLabel('Destinataire').fill('test-smtp@example.test')
    await page.getByRole('button', { name: 'Envoyer un test' }).click()
    await expect(page.getByText('Email de test envoyé à test-smtp@example.test.')).toBeVisible()
    await expect.poll(() => smtp.received.filter((message) => message.to.includes('test-smtp@example.test')).length).toBe(1)
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})
