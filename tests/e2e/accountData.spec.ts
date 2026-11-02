import { readFile } from 'node:fs/promises'
import { expect, type Download } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { linkToken, startTestSmtp } from '../integration/smtp'
import { E2E_PASSWORD, E2E_USERS } from './constants'
import { blockWith, expectLoggedIn, login, signIn, slugOf, test, testUser, uniqueName } from './helpers'

async function downloadedJson(download: Download) {
  return JSON.parse(await readFile((await download.path())!, 'utf8')) as unknown
}

// EPIC-013 (US-063) : nouvelle adresse confirmée par le lien reçu à cette adresse
test('la personne change son adresse email par le lien reçu', async ({ page }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const { user, email } = await testUser(prisma, 'Adresse')
    const newEmail = `${slugOf(uniqueName('nouvelle adresse'))}@example.test`

    await signIn(page, prisma, email)
    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    const form = page.locator('form').filter({ has: page.getByLabel('Nouvelle adresse') })
    await form.getByLabel('Nouvelle adresse').fill(newEmail)
    await form.getByLabel('Mot de passe actuel').fill(E2E_PASSWORD)
    await form.getByRole('button', { name: 'Recevoir le lien de confirmation' }).click()
    await expect(page.getByText(`Un lien de confirmation attend à ${newEmail}`)).toBeVisible()
    // L'adresse ne change qu'à l'ouverture du lien
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } })).email).toBe(email)

    await expect.poll(() => smtp.to(newEmail).length).toBe(1)
    await page.goto(`/acces/confirmer/${linkToken(smtp.to(newEmail)[0]!, '/acces/confirmer/')}`)
    await expect(page.getByText(`Votre compte utilise désormais l’adresse ${newEmail}.`)).toBeVisible()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } })).email).toBe(newEmail)
    // L'ancienne adresse est prévenue du changement
    await expect.poll(() => smtp.to(email).length).toBe(1)
    expect(smtp.to(email)[0]!.text).toContain(newEmail)
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})

// EPIC-013 (US-063) : changer son mot de passe déconnecte les autres appareils
test('la personne change son mot de passe, ses autres appareils sont déconnectés', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  try {
    const { email } = await testUser(prisma, 'Mot de passe')
    const other = await otherPage()
    await signIn(other, prisma, email)
    await signIn(page, prisma, email)

    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    const form = page.locator('form').filter({ has: page.getByLabel('Nouveau mot de passe') })
    await form.getByLabel('Mot de passe actuel').fill(E2E_PASSWORD)
    await form.getByLabel('Nouveau mot de passe').fill('un-nouveau-secret-1')
    await form.getByRole('button', { name: 'Changer le mot de passe' }).click()
    await expect(page.getByText('Mot de passe changé. Vos autres appareils sont déconnectés.')).toBeVisible()

    // Cet appareil reste connecté, l'autre revient à l'écran de connexion
    await page.reload()
    await expectLoggedIn(page)
    await other.reload()
    await expect(other.getByRole('button', { name: 'Se connecter' })).toBeVisible()

    // L'ancien mot de passe est refusé, le nouveau connecte
    await login(other, email)
    await expect(other.getByText('Email ou mot de passe incorrect')).toBeVisible()
    await login(other, email, 'un-nouveau-secret-1')
    await expectLoggedIn(other)
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-017 (US-076, US-077) : télécharger ses données, puis effacer son compte
test('la personne télécharge ses données puis efface son compte', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const { user, email } = await testUser(prisma, 'Effacement')

    await signIn(page, prisma, email)
    await page.goto('/compte')
    await page.waitForLoadState('networkidle')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Télécharger mes données' }).click()])
    expect(JSON.stringify(await downloadedJson(download))).toContain(email)

    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Effacer mon compte' }) })
    await form.getByLabel('Mot de passe').fill(E2E_PASSWORD)
    page.once('dialog', (dialog) => dialog.accept())
    await form.getByRole('button', { name: 'Effacer mon compte' }).click()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-007, US-076 : l'équipe exporte les données d'une personne (demande d'accès RGPD), puis supprime sa fiche
test('l’équipe exporte les données d’une fiche participant puis la supprime', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = uniqueName('Jeu RGPD')
    const game = await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
    const name = uniqueName('Rita Données')
    const participant = await prisma.participant.create({ data: { name, slug: slugOf(name), email: `${slugOf(name)}@example.test`, phone: '0611111111', gameLinks: { create: { gameId: game.id, notes: 'Végétarienne' } } } })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto(`/participants/${participant.slug}`)
    await page.waitForLoadState('networkidle')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Exporter ses données' }).click()])
    const exported = JSON.stringify(await downloadedJson(download))
    expect(exported).toContain(name)
    expect(exported).toContain('Végétarienne')

    await page.goto('/participants')
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('Rechercher un participant...').fill(name)
    const card = blockWith(page, page.getByRole('link', { name }), 'Supprimer')
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.getByRole('link', { name })).toBeHidden()
    expect(await prisma.participant.count({ where: { id: participant.id } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})
