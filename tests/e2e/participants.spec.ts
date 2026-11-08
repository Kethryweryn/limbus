import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { E2E_USERS } from './constants'
import { signIn, slugOf, uniqueName } from './helpers'

// EPIC-031 (US-118) : la liste des participants crée une fiche, la fiche se modifie et note un refus de photo
test('l’équipe crée une fiche participant, la renomme et note un refus de photo', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = uniqueName('Jeu participants')
    const game = await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
    const name = uniqueName('Iris Fiche')

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/participants')
    await page.waitForLoadState('networkidle')

    // Création depuis la liste : le jeu se choisit dans le menu
    await page.getByRole('button', { name: 'Créer un participant' }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('button', { name: 'Jeux' }).click()
    await page.getByRole('option', { name: title }).click()
    await page.keyboard.press('Escape')
    await form.getByLabel('Nom').fill(name)
    await form.getByLabel('Email').fill(`${slugOf(name)}@example.test`)
    await form.getByLabel(`Notes — ${title}`).fill('Vient en covoiturage.')

    // Un refus du serveur s'affiche dans le formulaire, qui reste ouvert
    await page.route('**/api/participants', (route) => route.request().method() === 'POST'
      ? route.fulfill({ status: 400, json: { message: 'Refus de test' } })
      : route.continue(), { times: 1 })
    await form.getByRole('button', { name: 'Créer' }).click()
    await expect(form.getByText('Refus de test')).toBeVisible()

    await form.getByRole('button', { name: 'Créer' }).click()
    await expect(form).toBeHidden()

    const created = await prisma.participant.findFirstOrThrow({ where: { name }, include: { gameLinks: true } })
    expect(created.gameLinks).toEqual([expect.objectContaining({ gameId: game.id, notes: 'Vient en covoiturage.' })])

    // Le contact d'urgence et les allergies viennent de son inscription (US-178)
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: slugOf(title), state: 'open' } })
    await prisma.registration.create({
      data: { periodId: period.id, participantId: created.id, status: 'received', source: 'form', email: created.email!, respondedAt: new Date(), emergencyContactName: 'Paul Secours', emergencyContactPhone: '0699999999', dietary: 'Sans gluten' }
    })

    // Modifier, sur la carte, n'ouvre pas la fiche (US-179)
    await page.getByPlaceholder('Rechercher un participant...').fill(name)
    const card = page.locator('.cursor-pointer').filter({ hasText: name })
    await card.getByRole('button', { name: 'Modifier' }).click()
    await expect(form).toBeVisible()
    await form.getByRole('button', { name: 'Annuler' }).click()
    await expect(form).toBeHidden()
    await expect(page).toHaveURL(/\/participants$/)

    // La fiche s'ouvre d'un clic sur la carte, hors du nom : notes du jeu, urgence et allergies, refus de photo noté puis levé
    await card.getByText('Vient en covoiturage.').click()
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    await expect(page.getByText('Vient en covoiturage.')).toBeVisible()
    await expect(page.getByText('Paul Secours · 0699999999')).toBeVisible()
    await expect(page.getByText('Sans gluten')).toBeVisible()
    await expect(page.getByText(`D'après son inscription à ${title}.`)).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Noter un refus de photo' }).click()
    await expect(page.getByText(/Photo refusée depuis le/)).toBeVisible()
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: created.id }, select: { photoRefusedAt: true } })).photoRefusedAt).not.toBeNull()
    await page.getByRole('button', { name: 'Lever le refus' }).click()
    await expect(page.getByText('Cette personne n’a pas refusé l’usage de sa photo.')).toBeVisible()

    // Renommer change l'adresse de la fiche
    const renamed = uniqueName('Iris Renommée')
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByLabel('Nom').fill(renamed)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('heading', { name: renamed, level: 1 })).toBeVisible()
    const saved = await prisma.participant.findUniqueOrThrow({ where: { id: created.id }, select: { name: true, slug: true } })
    expect(saved.name).toBe(renamed)
    await expect(page).toHaveURL(new RegExp(`/participants/${saved.slug}$`))
  } finally {
    await prisma.$disconnect()
  }
})
