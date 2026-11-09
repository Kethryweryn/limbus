// US-055 : envoyer un document à la session et vérifier l'email reçu
import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { parcoursPerson, parcoursSession, signIn, slugOf, uniqueName } from './helpers'

// US-187 : le public se choisit par cases, « Tout le monde » coche les quatre, la sélection avancée ajoute des personnages
test('le public d’un document se choisit par cases et par sélection avancée', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const gameTitle = uniqueName('Jeu public')
    const game = await prisma.game.create({ data: { title: gameTitle, slug: slugOf(gameTitle), description: '', ownerId: owner.id } })
    const characterName = uniqueName('Héraut')
    await prisma.character.create({ data: { name: characterName, slug: slugOf(characterName), gameId: game.id, type: 'pj' } })
    const title = uniqueName('Consignes e2e')

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Créer un document' }).click()
    const form = page.getByRole('dialog')
    await form.getByLabel('Jeu', { exact: true }).click()
    await page.getByRole('option', { name: gameTitle, exact: true }).click()
    await form.getByLabel('Titre', { exact: true }).fill(title)
    await form.getByLabel('Corps').fill('Texte des consignes.')

    const box = (name: string) => form.getByRole('checkbox', { name, exact: true })
    await box('Tout le monde').check()
    for (const role of ['Organisateurs', 'PNJ', 'Cuisine', 'PJ']) await expect(box(role)).toBeChecked()
    await box('PJ').uncheck()
    await expect(box('Tout le monde')).not.toBeChecked()

    await box('Sélection avancée').check()
    await form.getByRole('button', { name: 'Personnages' }).click()
    await page.getByRole('option', { name: `PJ - ${characterName}` }).click()
    await page.keyboard.press('Escape')
    await form.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(form).toBeHidden()

    const saved = await prisma.document.findFirstOrThrow({ where: { title }, select: { audiences: true, characterLinks: { select: { character: { select: { name: true } } } } } })
    expect([...saved.audiences].sort()).toEqual(['kitchen', 'npcs', 'organizers'])
    expect(saved.characterLinks.map((link) => link.character)).toEqual([{ name: characterName }])
    await expect(page.getByText('Organisateurs · PNJ · Cuisine · 1 personnage')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

test('un document envoyé à la session part par email, en pièce jointe', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const lea = await parcoursPerson(prisma, 'Léa Documents')
    const { session, game, character } = await parcoursSession(prisma, 'Session documents e2e', [['Aube', lea.name], ['Brume', 'Noé Parcours']])
    // Document destiné au seul personnage d'Aube
    const title = uniqueName('Lettre scellée e2e')
    await prisma.document.create({
      data: {
        title,
        slug: slugOf(title),
        content: 'Le sceau est brisé.',
        readyToSend: true,
        gameId: game.id,
        characterLinks: { create: { characterId: character('Aube').id } }
      }
    })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/sessions/${session.slug}?tab=documents`)
    await page.waitForLoadState('networkidle')

    const card = page.locator('article').filter({ hasText: title })
    await expect(card.getByText('0/1 destinataire(s) envoyé(s)')).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Envoyer aux manquants' }).click()

    await expect.poll(() => mailbox.to(lea.email).length).toBe(1)
    expect(mailbox.to(lea.email)[0]!.raw).toContain('application/pdf')
    await expect(card.getByText('1/1 destinataire(s) envoyé(s)')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
