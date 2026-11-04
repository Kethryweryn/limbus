import { expect, test } from '@playwright/test'
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from '../../utils/registrationForms'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { gamePanel, signIn } from './helpers'

// EPIC-037 (US-133) : l'encadré « Qualité du questionnaire » signale un personnage sans lien, puis plus rien une fois relié.
// EPIC-039 (US-136, US-139) : une fois la question reliée, les réponses reçues donnent leurs repères
// EPIC-040 (US-140) : et l'estimation générale
test('l’encadré de qualité signale un personnage sans lien, puis les repères sur les réponses après l’ajout du lien', async ({ page }) => {
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
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, name: 'Période', publicId: key, entryMode: 'form' } })
    for (const name of ['zoe', 'ines', 'leo', 'hugo']) {
      const email = `${name}-${key}@example.test`
      const person = await prisma.participant.create({ data: { name: `${name} ${key}`, slug: `${name}-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
      await prisma.registration.create({ data: { periodId: period.id, participantId: person.id, status: 'received', source: 'form', email, questionAnswers: { style: 'Intrigue' } } })
    }

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    await gamePanel(page, title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
    const dialog = page.getByRole('dialog')
    const missing = dialog.getByText('Aldric Qualité n’est relié à aucune réponse : l’assistant ne pourra lui proposer personne.')
    await expect(missing).toBeVisible()
    // Aucune question n'est reliée : les réponses reçues ne comptent pas encore
    await expect(dialog.getByText('Estimation générale')).toBeHidden()
    await expect(dialog.getByText('« Ton style » n’est reliée à aucun rôle : ses réponses ne comptent pas dans le casting.')).toBeVisible()

    // Relier l'option Intrigue au personnage
    await dialog.getByText('Personnages, factions, intrigues…').first().click()
    await page.getByRole('option', { name: 'Aldric Qualité' }).click()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByText('Aucun changement : la version en vigueur est conservée.')).toBeVisible()

    await expect(missing).toBeHidden()
    await expect(dialog.getByText('L’option « Combat » de « Ton style » n’est reliée à aucun rôle.')).toBeVisible()

    await expect(dialog.getByText('Estimation générale')).toBeVisible()
    await expect(dialog.getByText('Une fois les rôles répartis au mieux, chaque personne qui reçoit un rôle obtient en moyenne 100 % de sa meilleure note possible.')).toBeVisible()
    await expect(dialog.getByText('0 personne sur 4 a plusieurs personnages à égalité en tête.')).toBeVisible()
    await expect(dialog.getByText('4 personnes sur 4 ont répondu « Intrigue » à « Ton style » : cette question ne départage presque personne.')).toBeVisible()
    await expect(dialog.getByText('Aldric Qualité arrive en tête pour 4 personnes sur 4 : ce personnage sera disputé.')).toBeVisible()
    await expect(dialog.getByText('Ces repères portent sur le formulaire et les liens enregistrés, et sur les réponses de 4 personnes.')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-038 (US-135) : l'essai porte sur les liens pas encore enregistrés, et ne laisse rien
test('l’essai du questionnaire classe les personnages selon les réponses, sans rien enregistrer', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `essai-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = `Jeu ${key}`
    const game = await prisma.game.create({ data: { title, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    await prisma.character.create({ data: { name: 'Aldric Essai', slug: `aldric-${key}`, gameId: game.id } })
    await prisma.character.create({ data: { name: 'Bertrand Essai', slug: `bertrand-${key}`, gameId: game.id } })
    await prisma.registrationForm.create({
      data: {
        gameId: game.id,
        versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'style', label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] }] } } }
      }
    })
    await prisma.registrationPeriod.create({ data: { gameId: game.id, name: 'Période', publicId: key, entryMode: 'form' } })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    await gamePanel(page, title, 'Formulaire').getByRole('button', { name: 'Formulaire' }).click()
    const editor = page.getByRole('dialog', { name: /Formulaire d’inscription/ })
    const tryButton = editor.getByRole('button', { name: 'Essayer le questionnaire' })
    await expect(tryButton).toBeEnabled()

    // Sans lien, la fenêtre le dit
    await tryButton.click()
    const trial = page.getByRole('dialog', { name: 'Essayer le questionnaire' })
    await expect(trial.getByText('Aucune question n’est reliée à un rôle')).toBeVisible()
    await trial.getByRole('button', { name: 'Close' }).click()
    await expect(trial).toBeHidden()

    // Un lien pas encore enregistré compte dans l'essai
    await editor.getByText('Personnages, factions, intrigues…').first().click()
    await page.getByRole('option', { name: 'Aldric Essai' }).click()
    await page.keyboard.press('Escape')
    await tryButton.click()
    await expect(trial.getByText('Aldric Essai, Bertrand Essai')).toBeVisible()

    await trial.getByRole('radio', { name: 'Intrigue' }).check()
    await expect(trial.getByRole('listitem').filter({ hasText: 'Aldric Essai' })).toContainText('1 point')
    await expect(trial.getByText('« Ton style » : Intrigue → Aldric Essai (+1)')).toBeVisible()
    await expect(trial.getByText('Qu’aucune réponse donnée ne rejoint')).toBeVisible()
    await expect(trial.getByText('Bertrand Essai')).toBeVisible()

    // Fermer oublie les réponses et n'écrit rien
    await trial.getByRole('button', { name: 'Close' }).click()
    await expect(trial).toBeHidden()
    expect(await prisma.registration.count({ where: { period: { gameId: game.id } } })).toBe(0)
    expect(await prisma.registrationQuestionLink.count({ where: { gameId: game.id } })).toBe(0)
    await tryButton.click()
    await expect(trial.getByText('Aldric Essai, Bertrand Essai')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
