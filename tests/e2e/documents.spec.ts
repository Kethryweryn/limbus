// US-055 : envoyer un document à la session et vérifier l'email reçu
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { startTestSmtp } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { parcoursSession, signIn, slugOf, uniqueName } from './helpers'

test('un document envoyé à la session part par email, en pièce jointe', async ({ page }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const { session, game, character } = await parcoursSession(prisma, 'Session documents e2e', [['Aube', 'Léa Parcours'], ['Brume', 'Noé Parcours']])
    // Document destiné au seul personnage d'Aube
    const title = uniqueName('Lettre scellée e2e')
    await prisma.document.create({
      data: {
        title,
        slug: slugOf(title),
        content: 'Le sceau est brisé.',
        readyToSend: true,
        gameId: game.id,
        characters: { connect: { id: character('Aube').id } }
      }
    })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}?tab=documents`)
    await page.waitForLoadState('networkidle')

    const card = page.locator('article').filter({ hasText: title })
    await expect(card.getByText('0/1 destinataire(s) envoyé(s)')).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Envoyer aux manquants' }).click()

    await expect.poll(() => smtp.received.length).toBe(1)
    expect(smtp.received[0]!.to).toEqual(['lea.parcours@example.test'])
    expect(smtp.received[0]!.raw).toContain('application/pdf')
    await expect(card.getByText('1/1 destinataire(s) envoyé(s)')).toBeVisible()
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})
