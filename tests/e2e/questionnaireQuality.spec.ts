import { expect, test } from '@playwright/test'
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from '../../utils/registrationForms'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { gamePanel, signIn } from './helpers'

// EPIC-037 (US-133) : l'encadré « Qualité du questionnaire » signale un personnage sans lien, puis plus rien une fois relié
test('l’encadré de qualité signale un personnage sans lien, puis plus après l’ajout du lien', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `qualite-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = `Jeu ${key}`
    const game = await prisma.game.create({ data: { title, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    await prisma.character.create({ data: { name: 'Aldric Qualité', slug: `aldric-${key}`, gameId: game.id } })
    await prisma.registrationForm.create({
      data: {
        gameId: game.id,
        versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'style', label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] }] } } }
      }
    })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    await gamePanel(page, title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
    const dialog = page.getByRole('dialog')
    const missing = dialog.getByText('Aldric Qualité n’est relié à aucune réponse : l’assistant ne pourra lui proposer personne.')
    await expect(missing).toBeVisible()
    await expect(dialog.getByText('« Ton style » n’est reliée à aucun rôle : ses réponses ne comptent pas dans le casting.')).toBeVisible()

    // Relier l'option Intrigue au personnage
    await dialog.getByText('Personnages, factions, intrigues…').first().click()
    await page.getByRole('option', { name: 'Aldric Qualité' }).click()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByText('Aucun changement : la version en vigueur est conservée.')).toBeVisible()

    await expect(missing).toBeHidden()
    await expect(dialog.getByText('L’option « Combat » de « Ton style » n’est reliée à aucun rôle.')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
