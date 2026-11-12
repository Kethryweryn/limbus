import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { openMailbox } from './mailbox'
import { blockWith, signIn, slugOf, testUser, uniqueName } from './helpers'

// EPIC-031 (US-118) : l'administratrice crée un compte, le désactive, et teste l'envoi d'emails
test('l’administratrice crée et désactive un compte, puis teste l’envoi d’emails', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const { email: adminEmail } = await testUser(prisma, 'Admin', 'admin')
    const name = uniqueName('Compte Créé')
    const email = `${slugOf(name)}@example.test`

    await signIn(page, prisma, adminEmail)
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    const creation = page.locator('form').filter({ has: page.getByRole('button', { name: 'Créer' }) })
    await creation.getByLabel('Nom').fill(name)
    await creation.getByLabel('Email').fill(email)
    await creation.getByRole('button', { name: 'Créer' }).click()
    await expect(page.getByText(`Compte créé : ${email} a reçu un lien pour choisir son mot de passe.`)).toBeVisible()
    await expect.poll(() => mailbox.to(email).length).toBe(1)

    // Désactivation depuis la carte du compte
    const card = blockWith(page, page.getByRole('heading', { name, exact: true }), 'Désactiver')
    page.once('dialog', (dialog) => dialog.accept())
    await card.getByRole('button', { name: 'Désactiver' }).click()
    await expect(card.getByText('Désactivé', { exact: true })).toBeVisible()
    expect((await prisma.user.findUniqueOrThrow({ where: { email }, select: { disabledAt: true } })).disabledAt).not.toBeNull()

    // Configuration SMTP : lue, puis un email de test part
    await page.goto('/admin/smtp')
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('Serveur SMTP')).toHaveValue('127.0.0.1')
    await page.getByLabel('Destinataire').fill('test-smtp@example.test')
    await page.getByRole('button', { name: 'Envoyer un test' }).click()
    await expect(page.getByText('Email de test envoyé à test-smtp@example.test.')).toBeVisible()
    await expect.poll(() => mailbox.to('test-smtp@example.test').length).toBe(1)
  } finally {
    await prisma.$disconnect()
  }
})

// US-244, US-248 (ADR-0088) : un compte non activé est masqué par défaut ; affiché, sa carte est en lecture seule
test('les comptes non activés sont masqués derrière une case, en lecture seule, et se reprennent en les créant (US-244, US-248)', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const { email: adminEmail } = await testUser(prisma, 'Admin', 'admin')
    const email = `${slugOf(uniqueName('pre-cree'))}@example.test`
    const preCreated = await prisma.user.create({ data: { email, name: '', password: null, emailConfirmedAt: null } })
    const owner = await testUser(prisma, 'Orga du compte pré-créé')
    const title = uniqueName('Jeu du compte pré-créé')
    const game = await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.user.id } })
    await prisma.participant.create({ data: { slug: slugOf(uniqueName('fiche')), email, userId: preCreated.id, gameLinks: { create: { gameId: game.id, name: 'Paul' } } } })

    await signIn(page, prisma, adminEmail)
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    // Masqué par défaut ; la case le montre, avec sa mention, sans champ ni bouton
    await expect(page.getByText(email, { exact: true })).toHaveCount(0)
    await page.getByRole('checkbox', { name: /^Afficher les comptes non activés \(\d+\)$/ }).check()
    const card = page.locator('div').filter({ has: page.getByText(email, { exact: true }) }).filter({ hasText: 'Ce compte n’est pas activé' }).last()
    await expect(card.getByText('Ce compte n’est pas activé : la personne l’active elle-même, ou créez un compte à son adresse pour le reprendre.')).toBeVisible()
    await expect(card.getByRole('button')).toHaveCount(0)
    await expect(card.getByRole('textbox')).toHaveCount(0)
    expect(mailbox.to(email)).toHaveLength(0)

    // Le créer à son adresse le reprend : même compte, nom saisi, lien envoyé
    const creation = page.locator('form').filter({ has: page.getByRole('button', { name: 'Créer' }) })
    await creation.getByLabel('Nom').fill('Paul Repris')
    await creation.getByLabel('Email').fill(email)
    await creation.getByRole('button', { name: 'Créer' }).click()
    await expect(page.getByText(`Compte créé : ${email} a reçu un lien pour choisir son mot de passe.`)).toBeVisible()
    await expect.poll(() => mailbox.to(email).length).toBe(1)
    expect(await prisma.user.findUniqueOrThrow({ where: { email } })).toMatchObject({ id: preCreated.id, name: 'Paul Repris' })
  } finally {
    await prisma.$disconnect()
  }
})
