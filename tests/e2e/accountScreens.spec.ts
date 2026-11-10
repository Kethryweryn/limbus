import { createHash, randomBytes } from 'node:crypto'
import { expect } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { linkToken } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { openMailbox } from './mailbox'
import { blockWith, expectLoggedIn, openUserMenu, orgaGame, signIn, slugOf, test, testUser, uniqueName } from './helpers'

// EPIC-050, lot 4 (US-201) : inscription libre, compte, invitations à co-organiser et administration, sur les quatre
// axes (actions, erreurs de saisie, droits, hors ligne)

// Invitation à co-organiser un jeu, créée en base, et son lien
async function shareInvitation(prisma: ReturnType<typeof createTestPrisma>, gameId: string, email: string, data: { status?: 'pending' | 'revoked', expiresAt?: Date } = {}) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
  const token = randomBytes(32).toString('hex')
  await prisma.gameInvitation.create({
    data: {
      gameId, email, invitedById: owner.id, tokenHash: createHash('sha256').update(token).digest('hex'),
      status: data.status ?? 'pending', expiresAt: data.expiresAt ?? new Date(Date.now() + 14 * 86_400_000)
    }
  })
  return token
}

test.describe('inscription libre', () => {
  // L'inscription est limitée à 5 par heure et par adresse IP (US-061) : chaque test arrive d'une adresse qui lui
  // est propre, que le serveur lit dans X-Forwarded-For puisque le navigateur des tests est sur la même machine
  test.beforeEach(async ({ context }) => {
    const part = () => Math.floor(Math.random() * 254) + 1
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${part()}.${part()}.${part()}` })
  })

  test('un champ manquant ou un mot de passe trop court est refusé avec son message, sans créer de compte', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const name = uniqueName('Inscription Refusée')
      const email = `${slugOf(name)}@example.test`
      await page.goto('/acces/inscription')
      await page.waitForLoadState('networkidle')
      const submit = page.getByRole('button', { name: 'Créer mon compte' })

      await submit.click()
      await expect(page.getByText(/Le nom est obligatoire/)).toBeVisible()

      await page.getByLabel('Nom').fill(name)
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Mot de passe').fill('court')
      await page.getByLabel(/J’accepte les conditions d’utilisation/).check()
      await submit.click()
      await expect(page.getByText(/Le mot de passe doit faire au moins 8 caractères/)).toBeVisible()

      await page.getByLabel('Mot de passe').fill('assez-long-1')
      await page.getByLabel(/J’accepte les conditions d’utilisation/).uncheck()
      await submit.click()
      await expect(page.getByText(/Acceptez les conditions d’utilisation pour créer votre compte/)).toBeVisible()
      expect(await prisma.user.count({ where: { email } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('l’adresse d’un compte confirmé reçoit la même réponse, et un email « compte existant »', async ({ page }) => {
    const prisma = createTestPrisma()
    const mailbox = openMailbox()
    try {
      const { user, email } = await testUser(prisma, 'Déjà Inscrite')
      await page.goto('/acces/inscription')
      await page.waitForLoadState('networkidle')
      await page.getByLabel('Nom').fill('Quelqu’un d’autre')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Mot de passe').fill('autre-secret-1')
      await page.getByLabel(/J’accepte les conditions d’utilisation/).check()
      await page.getByRole('button', { name: 'Créer mon compte' }).click()
      await expect(page.getByText(`Si l’adresse ${email} peut recevoir un compte, un lien de confirmation vient d’y partir.`, { exact: false })).toBeVisible()

      await expect.poll(() => mailbox.to(email).length).toBe(1)
      const message = mailbox.to(email)[0]!
      expect(message.text).toContain('qui en a déjà un')
      expect(message.text).toContain('/acces/mot-de-passe-oublie')
      // Le compte n'a pas changé : ni son nom ni son mot de passe
      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, password: true } })
      expect(after).toEqual({ name: user.name, password: user.password })
    } finally {
      await prisma.$disconnect()
    }
  })

  test('le champ invisible rempli par un robot : même réponse, aucun compte ni email', async ({ page }) => {
    const prisma = createTestPrisma()
    const mailbox = openMailbox()
    try {
      const name = uniqueName('Robot')
      const email = `${slugOf(name)}@example.test`
      await page.goto('/acces/inscription')
      await page.waitForLoadState('networkidle')
      await page.getByLabel('Nom').fill(name)
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Mot de passe').fill('robot-secret-1')
      await page.getByLabel(/J’accepte les conditions d’utilisation/).check()
      await page.locator('input[name="website"]').fill('https://robot.example.test', { force: true })
      await page.getByRole('button', { name: 'Créer mon compte' }).click()
      await expect(page.getByText(`Si l’adresse ${email} peut recevoir un compte`, { exact: false })).toBeVisible()
      // Le serveur répond sans rien envoyer : une fois la réponse affichée, aucun email n'est en route
      expect(await prisma.user.count({ where: { email } })).toBe(0)
      expect(mailbox.to(email)).toEqual([])
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, la création est refusée et le dit', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const name = uniqueName('Hors Réseau')
      const email = `${slugOf(name)}@example.test`
      await page.goto('/acces/inscription')
      await page.waitForLoadState('networkidle')
      await page.getByLabel('Nom').fill(name)
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Mot de passe').fill('reseau-coupe-1')
      await page.getByLabel(/J’accepte les conditions d’utilisation/).check()
      await context.setOffline(true)
      await page.getByRole('button', { name: 'Créer mon compte' }).click()
      await expect(page.getByText(/pas de réseau|hors ligne/i)).toBeVisible()
      await context.setOffline(false)
      expect(await prisma.user.count({ where: { email } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('mon compte', () => {
  test('le nom et les coordonnées changés sont recopiés sur les fiches de la personne', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { user, email } = await testUser(prisma, 'Compte Fiche')
      const game = await orgaGame(prisma, 'Jeu du compte')
      const participant = await prisma.participant.create({ data: { name: user.name, slug: slugOf(user.name), email, userId: user.id, gameLinks: { create: { gameId: game.id } } } })

      await signIn(page, prisma, email)
      await page.goto('/compte')
      await page.waitForLoadState('networkidle')
      const name = uniqueName('Nom Recopié')
      await page.getByLabel('Nom', { exact: true }).fill(name)
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
      await expect(page.getByText('Nom enregistré.')).toBeVisible()
      await page.getByLabel('Téléphone', { exact: true }).fill('0644556677')
      await page.getByRole('button', { name: 'Enregistrer mes coordonnées' }).click()
      await expect(page.getByText('Coordonnées enregistrées : vos fiches et inscriptions sont à jour.')).toBeVisible()

      const sheet = await prisma.participant.findUniqueOrThrow({ where: { id: participant.id }, select: { name: true, phone: true } })
      expect(sheet).toEqual({ name, phone: '0644556677' })
    } finally {
      await prisma.$disconnect()
    }
  })

  test('chaque formulaire refuse une saisie invalide avec son message, sans rien changer', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { user, email } = await testUser(prisma, 'Compte Erreurs')
      await signIn(page, prisma, email)
      await page.goto('/compte')
      await page.waitForLoadState('networkidle')

      await page.getByLabel('Nom', { exact: true }).fill('')
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
      // Le message s'affiche dans la carte du formulaire envoyé (US-216)
      const nameCard = blockWith(page, page.getByRole('heading', { name: 'Nom', exact: true }), 'Enregistrer')
      await expect(nameCard.getByText(/Le nom est obligatoire/)).toBeVisible()

      await page.getByLabel('Nouvelle adresse').fill(`autre-${email}`)
      await page.getByLabel('Mot de passe actuel').first().fill('mauvais-mot-de-passe')
      await page.getByRole('button', { name: 'Recevoir le lien de confirmation' }).click()
      const emailCard = blockWith(page, page.getByRole('heading', { name: 'Email', exact: true }), 'Recevoir le lien de confirmation')
      await expect(emailCard.getByText(/Mot de passe incorrect/i)).toBeVisible()
      await expect(nameCard.getByText(/Le nom est obligatoire/)).toBeHidden()

      await page.getByLabel('Mot de passe actuel').nth(1).fill('mot-de-passe-e2e')
      await page.getByLabel('Nouveau mot de passe').fill('court')
      await page.getByRole('button', { name: 'Changer le mot de passe' }).click()
      await expect(page.getByText(/Le mot de passe doit faire au moins 8 caractères/)).toBeVisible()

      await page.getByLabel('Régime, allergies et intolérances').fill('Arachides')
      await page.getByRole('button', { name: 'Enregistrer mes coordonnées' }).click()
      await expect(page.getByText(/Le consentement est nécessaire pour enregistrer des allergies ou intolérances/)).toBeVisible()

      page.once('dialog', (dialog) => dialog.accept())
      await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe')
      await page.getByRole('button', { name: 'Effacer mon compte' }).click()
      await expect(page.getByText(/Mot de passe incorrect/i)).toBeVisible()

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, password: true, dietary: true, _count: { select: { accountTokens: true } } } })
      expect(after).toEqual({ name: user.name, password: user.password, dietary: null, _count: { accountTokens: 0 } })
    } finally {
      await prisma.$disconnect()
    }
  })

  test('sans connexion, le compte renvoie à l’écran de connexion', async ({ page }) => {
    await page.goto('/compte')
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeHidden()
  })

  test('hors ligne, une modification du compte est refusée et le dit', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const { user, email } = await testUser(prisma, 'Compte Hors Ligne')
      await signIn(page, prisma, email)
      await page.goto('/compte')
      await page.waitForLoadState('networkidle')
      await context.setOffline(true)
      await page.getByLabel('Nom', { exact: true }).fill(uniqueName('Nom Hors Ligne'))
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
      await expect(page.getByText(/pas de réseau|hors ligne/i)).toBeVisible()
      await context.setOffline(false)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } })).name).toBe(user.name)
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('invitation à co-organiser', () => {
  test('une invitation expirée ou annulée est refusée', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu des invitations closes')
      const { email } = await testUser(prisma, 'Invitée close')
      const expired = await shareInvitation(prisma, game.id, email, { expiresAt: new Date(Date.now() - 1000) })
      const revoked = await shareInvitation(prisma, game.id, email, { status: 'revoked' })

      await page.goto(`/invitations/${expired}`)
      await expect(page.getByText('Invitation expirée')).toBeVisible()
      await page.goto(`/invitations/${revoked}`)
      await expect(page.getByText('Invitation déjà utilisée ou annulée')).toBeVisible()
      await page.goto('/invitations/lien-inconnu')
      await expect(page.getByText('Invitation introuvable')).toBeVisible()
      await expect(page.getByRole('button', { name: /Accepter|Créer mon compte/ })).toBeHidden()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('le compte d’une autre adresse ne peut pas accepter', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu de la mauvaise adresse')
      const { email: invited } = await testUser(prisma, 'Invitée attendue')
      const { user: other, email: otherEmail } = await testUser(prisma, 'Autre compte')
      const token = await shareInvitation(prisma, game.id, invited)

      await signIn(page, prisma, otherEmail)
      await page.goto(`/invitations/${token}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('Cette invitation a été envoyée à une autre adresse', { exact: false })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Accepter l’invitation' })).toBeHidden()
      expect(await prisma.gameShare.count({ where: { gameId: game.id, userId: other.id } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('créer son compte depuis l’invitation : mot de passe trop court refusé, puis compte confirmé et jeu partagé', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const game = await orgaGame(prisma, 'Jeu de la nouvelle venue')
      const name = uniqueName('Nouvelle Co-orga')
      const email = `${slugOf(name)}@example.test`
      const token = await shareInvitation(prisma, game.id, email)

      await page.goto(`/invitations/${token}`)
      await page.waitForLoadState('networkidle')
      await page.getByLabel('Nom').fill(name)
      await page.getByLabel('Mot de passe').fill('court')
      await page.getByLabel(/J’accepte les conditions d’utilisation/).check()
      await page.getByRole('button', { name: 'Créer mon compte et accepter' }).click()
      await expect(page.getByText(/Le mot de passe doit faire au moins 8 caractères/)).toBeVisible()
      expect(await prisma.user.count({ where: { email } })).toBe(0)

      await page.getByLabel('Mot de passe').fill('co-orga-secret-1')
      await page.getByRole('button', { name: 'Créer mon compte et accepter' }).click()
      await expect(page).toHaveURL(new RegExp(`/games/${game.slug}$`))
      const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, emailConfirmedAt: true } })
      expect(user.emailConfirmedAt).not.toBeNull()
      expect(await prisma.gameShare.count({ where: { gameId: game.id, userId: user.id } })).toBe(1)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('la propriétaire et une personne qui a déjà accès ne s’invitent pas ; une invitation annulée ne sert plus', async ({ page }) => {
    const prisma = createTestPrisma()
    const mailbox = openMailbox()
    try {
      const game = await orgaGame(prisma, 'Jeu des invitations refusées')
      const { user: coOrga, email: coOrgaEmail } = await testUser(prisma, 'Déjà co-orga')
      await prisma.gameShare.create({ data: { gameId: game.id, userId: coOrga.id } })
      const { email: invitedEmail } = await testUser(prisma, 'Invitée annulée')

      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(`/games/${game.slug}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Partager' }).click()
      const share = page.getByRole('dialog')
      const field = share.getByPlaceholder('email@exemple.fr')

      await share.getByRole('button', { name: 'Inviter' }).click()
      await expect(share.getByText(/L’email est obligatoire/)).toBeVisible()

      await field.fill(E2E_USERS.orga)
      await share.getByRole('button', { name: 'Inviter' }).click()
      await expect(share.getByText('Cet utilisateur possède déjà ce jeu')).toBeVisible()

      await field.fill(coOrgaEmail)
      await share.getByRole('button', { name: 'Inviter' }).click()
      await expect(share.getByText('Cet utilisateur a déjà accès au jeu')).toBeVisible()
      expect(await prisma.gameInvitation.count({ where: { gameId: game.id } })).toBe(0)

      await field.fill(invitedEmail)
      await share.getByRole('button', { name: 'Inviter' }).click()
      await expect(share.getByText(`Invitation envoyée à ${invitedEmail}.`)).toBeVisible()
      await expect.poll(() => mailbox.to(invitedEmail).length).toBe(1)
      const token = linkToken(mailbox.to(invitedEmail)[0]!, '/invitations/')!

      await blockWith(page, page.getByText(invitedEmail, { exact: true }), 'Annuler').getByRole('button', { name: 'Annuler' }).click()
      // Annuler retire l'invitation : son lien ne mène plus à rien
      await expect(share.getByText(invitedEmail, { exact: true })).toBeHidden()
      await page.goto(`/invitations/${token}`)
      await expect(page.getByText('Invitation introuvable')).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('administration', () => {
  test('création refusée sans nom, avec une adresse invalide ou déjà prise', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { email: adminEmail } = await testUser(prisma, 'Admin Erreurs', 'admin')
      const { email: taken } = await testUser(prisma, 'Adresse Prise')
      await signIn(page, prisma, adminEmail)
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')
      const creation = page.locator('form').filter({ has: page.getByRole('button', { name: 'Créer' }) })
      const name = uniqueName('Compte Invalide')

      await creation.getByRole('button', { name: 'Créer' }).click()
      await expect(page.getByText(/Le nom est obligatoire/)).toBeVisible()

      await creation.getByLabel('Nom').fill(name)
      await creation.getByLabel('Email').fill('adresse-sans-arobase')
      await creation.getByRole('button', { name: 'Créer' }).click()
      await expect(page.getByText(/Email invalide|Adresse invalide/i)).toBeVisible()

      await creation.getByLabel('Email').fill(taken)
      await creation.getByRole('button', { name: 'Créer' }).click()
      await expect(page.getByText('Un compte existe déjà pour cette adresse.')).toBeVisible()
      expect(await prisma.user.count({ where: { name } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('plafond de stockage, réactivation, et suppression refusée tant que le compte possède un jeu', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { user: admin, email: adminEmail } = await testUser(prisma, 'Admin Comptes', 'admin')
      const { user: owner } = await testUser(prisma, 'Propriétaire Jeu')
      const title = uniqueName('Jeu à transférer')
      await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.id } })
      const { user: idle } = await testUser(prisma, 'Compte Désactivé')
      await prisma.user.update({ where: { id: idle.id }, data: { disabledAt: new Date() } })

      await signIn(page, prisma, adminEmail)
      await page.goto('/admin/users')
      await page.waitForLoadState('networkidle')

      const ownerCard = blockWith(page, page.getByRole('heading', { name: owner.name, exact: true }), 'Supprimer')
      await ownerCard.getByLabel('Plafond de stockage (Mo)').fill('250')
      await ownerCard.getByRole('button', { name: 'Enregistrer' }).click()
      // Le résultat s'affiche dans la carte du compte (US-216)
      await expect(ownerCard.getByText('Compte enregistré.')).toBeVisible()
      await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: owner.id }, select: { storageQuotaMb: true } })).storageQuotaMb).toBe(250)

      page.once('dialog', (dialog) => dialog.accept())
      await ownerCard.getByRole('button', { name: 'Supprimer' }).click()
      await expect(ownerCard.getByText('Cet utilisateur possède encore des jeux. Transférez-les avant suppression.')).toBeVisible()
      expect(await prisma.user.count({ where: { id: owner.id } })).toBe(1)

      const idleCard = blockWith(page, page.getByRole('heading', { name: idle.name, exact: true }), 'Supprimer')
      await idleCard.getByRole('button', { name: 'Réactiver' }).click()
      await expect(idleCard.getByRole('button', { name: 'Désactiver' })).toBeVisible()
      expect((await prisma.user.findUniqueOrThrow({ where: { id: idle.id }, select: { disabledAt: true } })).disabledAt).toBeNull()

      page.once('dialog', (dialog) => dialog.accept())
      await idleCard.getByRole('button', { name: 'Supprimer' }).click()
      await expect(page.getByRole('heading', { name: idle.name, exact: true })).toBeHidden()
      expect(await prisma.user.count({ where: { id: idle.id } })).toBe(0)

      // Son propre compte : ni désactivation ni suppression
      const ownCard = blockWith(page, page.getByRole('heading', { name: admin.name, exact: true }), 'Supprimer')
      await expect(ownCard.getByRole('button', { name: 'Désactiver' })).toBeDisabled()
      await expect(ownCard.getByRole('button', { name: 'Supprimer' })).toBeDisabled()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('le réglage SMTP refuse un envoi activé sans serveur, sans rien enregistrer', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { email: adminEmail } = await testUser(prisma, 'Admin SMTP', 'admin')
      await signIn(page, prisma, adminEmail)
      await page.goto('/admin/smtp')
      await page.waitForLoadState('networkidle')
      await expect(page.getByLabel('Serveur SMTP')).toHaveValue('127.0.0.1')
      await page.getByLabel('Serveur SMTP').fill('')
      await page.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByText(/Le serveur SMTP est obligatoire quand l’envoi est activé/)).toBeVisible()

      await page.getByLabel('Destinataire').fill('')
      await page.getByRole('button', { name: 'Envoyer un test' }).click()
      await expect(page.getByText('Le destinataire est obligatoire')).toBeVisible()

      await page.reload()
      await page.waitForLoadState('networkidle')
      await expect(page.getByLabel('Serveur SMTP')).toHaveValue('127.0.0.1')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('le mode administrateur ouvre les jeux des autres, puis se referme', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const { email: adminEmail } = await testUser(prisma, 'Admin Mode', 'admin')
      const game = await orgaGame(prisma, 'Jeu vu en mode admin')
      await signIn(page, prisma, adminEmail)

      // Hors mode administrateur, le jeu d'une autre organisatrice est refusé comme s'il n'existait pas (R7)
      const refused = async () => {
        await page.goto(`/games/${game.slug}`)
        await expect(page.getByRole('heading', { name: 'Page introuvable', level: 1 })).toBeVisible()
        await expect(page.getByRole('heading', { name: game.title, level: 1 })).toBeHidden()
      }
      // Le menu attend la réponse du serveur, qui pose le cookie du mode, avant que la page change
      const toggle = async (label: string) => {
        await openUserMenu(page)
        const done = page.waitForResponse((response) => response.url().endsWith('/api/admin/mode') && response.ok())
        await page.getByRole('menuitem', { name: label }).click()
        await done
      }

      await refused()
      await page.goto('/compte')
      await page.waitForLoadState('networkidle')
      await toggle('Activer le mode admin')
      await page.goto(`/games/${game.slug}`)
      await expect(page.getByRole('heading', { name: game.title, level: 1 })).toBeVisible()

      await toggle('Désactiver le mode admin')
      await refused()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une organisatrice qui n’administre pas n’a ni menu ni page d’administration', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      await signIn(page, prisma, E2E_USERS.orga)
      await expectLoggedIn(page)
      await expect(page.getByRole('link', { name: 'Utilisateurs' })).toBeHidden()
      await openUserMenu(page)
      await expect(page.getByRole('menuitem', { name: 'Activer le mode admin' })).toBeHidden()
      await page.keyboard.press('Escape')

      await page.goto('/admin/users')
      await expect(page.getByText('Réservé à l’administration')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Créer' })).toBeHidden()
    } finally {
      await prisma.$disconnect()
    }
  })
})
