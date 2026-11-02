// US-056 : tarif, versement, place offerte, puis email de paiement aux seules personnes qui doivent encore
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { choose, parcoursPerson, parcoursSession, signIn } from './helpers'

test('l’email de paiement ne part qu’à qui doit encore, pas à une place offerte', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const lea = await parcoursPerson(prisma, 'Léa Paiements')
    const noe = await parcoursPerson(prisma, 'Noé Paiements')
    const { session } = await parcoursSession(prisma, 'Session paiements e2e', [['Aube', lea.name], ['Brume', noe.name]])
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
    await expect(row(lea.name).getByText('Dû 50,00')).toBeVisible()

    // Léa verse 20 € ; la place de Noé est offerte
    await row(lea.name).getByLabel('Versement (€)').fill('20')
    await row(lea.name).getByRole('button', { name: 'Noter le versement' }).click()
    await expect(row(lea.name).getByText(/reste 30,00/).first()).toBeVisible()
    await row(noe.name).getByRole('button', { name: 'Offrir la place' }).click()
    await expect(row(noe.name).getByRole('button', { name: 'Ne plus offrir la place' })).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Envoyer / relancer les manquants' }).click()

    await expect.poll(() => mailbox.to(lea.email).length).toBe(1)
    expect(mailbox.to(noe.email)).toEqual([])
    await expect(row(lea.name).getByText(/Email envoyé le/)).toBeVisible()
    await expect(row(noe.name).getByText('Email non envoyé')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
