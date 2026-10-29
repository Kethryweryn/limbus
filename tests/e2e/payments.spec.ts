// US-056 : tarif, versement, place offerte, puis email de paiement aux seules personnes qui doivent encore
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { startTestSmtp } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { choose, parcoursSession, signIn } from './helpers'

test('l’email de paiement ne part qu’à qui doit encore, pas à une place offerte', async ({ page }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const { session } = await parcoursSession(prisma, 'Session paiements e2e', [['Aube', 'Léa Parcours'], ['Brume', 'Noé Parcours']])
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}?tab=payments`)
    await page.waitForLoadState('networkidle')

    // Tarif PJ de 50 €, appliqué par défaut aux PJ
    const tariffForm = page.locator('form').filter({ has: page.getByPlaceholder('PJ, PNJ, réduit, soutien…') })
    await tariffForm.getByPlaceholder('PJ, PNJ, réduit, soutien…').fill('PJ')
    await tariffForm.getByLabel('Montant (€)').fill('50')
    await choose(page, tariffForm.getByRole('combobox').first(), /^PJ$/)
    await tariffForm.getByRole('button', { name: 'Ajouter' }).click()

    const row = (name: string) => page.locator('article').filter({ hasText: name })
    await expect(row('Léa Parcours').getByText('Dû 50,00')).toBeVisible()

    // Léa verse 20 € ; la place de Noé est offerte
    await row('Léa Parcours').getByLabel('Versement (€)').fill('20')
    await row('Léa Parcours').getByRole('button', { name: 'Noter le versement' }).click()
    await expect(row('Léa Parcours').getByText(/reste 30,00/).first()).toBeVisible()
    await row('Noé Parcours').getByRole('button', { name: 'Offrir la place' }).click()
    await expect(row('Noé Parcours').getByRole('button', { name: 'Ne plus offrir la place' })).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Envoyer / relancer les manquants' }).click()

    await expect.poll(() => smtp.received.length).toBe(1)
    expect(smtp.received[0]!.to).toEqual(['lea.parcours@example.test'])
    await expect(row('Léa Parcours').getByText(/Email envoyé le/)).toBeVisible()
    await expect(row('Noé Parcours').getByText('Email non envoyé')).toBeVisible()
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})
