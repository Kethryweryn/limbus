// US-054 : générer les trombinoscopes d'une session castée et ouvrir le PDF
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { parcoursSession, signIn } from './helpers'

test('les trombinoscopes se génèrent et s’ouvrent en PDF', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { session } = await parcoursSession(prisma, 'Session trombinoscopes e2e', [['Aube', 'Léa Parcours'], ['Brume', 'Noé Parcours']])
    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}?tab=documents`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Trombi à générer')).toHaveCount(2)

    await page.getByRole('button', { name: 'Générer les trombinoscopes' }).click()
    await expect(page.getByText('Trombi généré')).toHaveCount(2)

    // « Vérifier le trombi » ouvre un nouvel onglet et y charge le PDF, sans erreur dans la page
    const popup = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Vérifier le trombi' }).first().click()
    await popup
    await expect(page.getByRole('button', { name: 'Vérifier le trombi' }).first()).toBeEnabled()
    await expect(page.getByText('Impossible de charger le PDF')).toBeHidden()

    const pdf = await page.request.get(`/api/sessions/${session.id}/trombinoscopes/${(await prisma.character.findFirstOrThrow({ where: { slug: 'aube-parcours' } })).id}`)
    expect(pdf.ok()).toBe(true)
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')
  } finally {
    await prisma.$disconnect()
  }
})
