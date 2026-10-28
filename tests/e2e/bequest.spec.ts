import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { startTestSmtp } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { expectLoggedIn, login } from './helpers'

// US-010 : la propriétaire lègue une copie depuis la fiche du jeu, la destinataire la retrouve avec son crédit
test('un jeu légué apparaît chez la destinataire avec son crédit', async ({ page, browser }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    await login(page, E2E_USERS.orga)
    await expectLoggedIn(page)
    await page.goto('/games/jeu-teaser')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Léguer une copie' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Les participants')).toBeVisible()
    await dialog.getByLabel('Email de la destinataire').fill(E2E_USERS.heritiere)
    await dialog.getByText('Je confirme vouloir léguer une copie de ce jeu à cette personne.').click()
    await dialog.getByRole('button', { name: 'Léguer une copie' }).click()
    await expect(dialog.getByText('Copie léguée à heritiere, qui a été prévenue par email.')).toBeVisible()
    await expect.poll(() => smtp.received.length).toBe(1)
    expect(smtp.received[0]!.to).toEqual([E2E_USERS.heritiere])

    const heir = await (await browser.newContext()).newPage()
    await login(heir, E2E_USERS.heritiere)
    await expectLoggedIn(heir)
    const link = smtp.received[0]!.text.match(/\/games\/[\w-]+/)![0]
    await heir.goto(link)
    await expect(heir.getByRole('heading', { name: 'Jeu avec teaser' })).toBeVisible()
    await expect(heir.getByTestId('game-credit')).toHaveText('D’après « Jeu avec teaser », de orga')
    // La copie démarre sans page publique, et sa destinataire peut la léguer à son tour
    await expect(heir.getByRole('button', { name: 'Dépublier' })).toBeHidden()
    await expect(heir.getByRole('button', { name: 'Léguer une copie' })).toBeVisible()
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})
