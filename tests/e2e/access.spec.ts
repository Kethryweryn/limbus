import { expect, test } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { linkToken } from '../integration/smtp'
import { openMailbox } from './mailbox'
import { expectLoggedIn, login, slugOf, testUser, uniqueName } from './helpers'

// EPIC-013 (US-062) : mot de passe oublié, lien reçu par email, nouveau mot de passe qui connecte
test('une personne qui a oublié son mot de passe en choisit un nouveau par le lien reçu', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const { email } = await testUser(prisma, 'Oubli')

    await page.goto('/acces/mot-de-passe-oublie')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Recevoir le lien' }).click()
    await expect(page.getByText(`Si un compte utilise ${email}, un lien vient d’y partir.`)).toBeVisible()

    // Une adresse inconnue reçoit la même réponse, sans email : rien n'apprend qu'un compte existe
    const unknown = `${slugOf(uniqueName('inconnue'))}@example.test`
    await page.goto('/acces/mot-de-passe-oublie')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Email').fill(unknown)
    await page.getByRole('button', { name: 'Recevoir le lien' }).click()
    await expect(page.getByText(`Si un compte utilise ${unknown}, un lien vient d’y partir.`)).toBeVisible()

    await expect.poll(() => mailbox.to(email).length).toBe(1)
    expect(mailbox.to(unknown)).toEqual([])
    const token = linkToken(mailbox.to(email)[0]!, '/acces/mot-de-passe/')
    await page.goto(`/acces/mot-de-passe/${token}`)
    await page.waitForLoadState('networkidle')

    // Les deux saisies doivent concorder
    await page.getByLabel('Nouveau mot de passe').fill('nouveau-secret-1')
    await page.getByLabel('Confirmation').fill('autre-secret-1')
    await page.getByRole('button', { name: 'Enregistrer et me connecter' }).click()
    await expect(page.getByText('Les deux mots de passe ne correspondent pas.')).toBeVisible()

    await page.getByLabel('Confirmation').fill('nouveau-secret-1')
    await page.getByRole('button', { name: 'Enregistrer et me connecter' }).click()
    await expectLoggedIn(page)
    // L'accueil redirige vers le dernier espace utilisé : attendre la fin, sinon elle interrompt la navigation suivante
    await page.waitForLoadState('networkidle')

    // Le lien ne sert qu'une fois, et le nouveau mot de passe ouvre une session
    await page.context().clearCookies()
    await page.goto(`/acces/mot-de-passe/${token}`)
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Nouveau mot de passe').fill('encore-un-autre-1')
    await page.getByLabel('Confirmation').fill('encore-un-autre-1')
    await page.getByRole('button', { name: 'Enregistrer et me connecter' }).click()
    await expect(page.getByText('Ce lien n’est plus valable : il a déjà servi ou a été remplacé par un plus récent.')).toBeVisible()

    await login(page, email, 'nouveau-secret-1')
    await expectLoggedIn(page)
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-013 (US-061) : inscription libre, confirmation de l'adresse par le lien reçu, qui connecte
test('une personne crée son compte et le confirme par le lien reçu', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const name = uniqueName('Nouvelle Venue')
    const email = `${slugOf(name)}@example.test`

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: 'Créer un compte' }).click()
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Nom').fill(name)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Mot de passe').fill('mon-secret-1')
    await page.getByLabel(/J’accepte les conditions d’utilisation/).check()
    await page.getByRole('button', { name: 'Créer mon compte' }).click()
    await expect(page.getByText(`Si l’adresse ${email} peut recevoir un compte, un lien de confirmation vient d’y partir.`)).toBeVisible()

    // Adresse pas encore confirmée tant que le lien n'est pas ouvert
    expect((await prisma.user.findUniqueOrThrow({ where: { email }, select: { emailConfirmedAt: true } })).emailConfirmedAt).toBeNull()

    await expect.poll(() => mailbox.to(email).length).toBe(1)
    const token = linkToken(mailbox.to(email)[0]!, '/acces/confirmer/')
    await page.goto(`/acces/confirmer/${token}`)
    await expect(page.getByText('Votre adresse est confirmée : votre compte est actif.')).toBeVisible()
    await page.getByRole('button', { name: 'Ouvrir Limbus' }).click()
    await expectLoggedIn(page)
    expect((await prisma.user.findUniqueOrThrow({ where: { email }, select: { emailConfirmedAt: true } })).emailConfirmedAt).not.toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

test('un lien de confirmation inconnu est refusé', async ({ page }) => {
  await page.goto('/acces/confirmer/jeton-inconnu')
  await expect(page.getByText('Ce lien n’est plus valable : il a déjà servi ou a été remplacé par un plus récent.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ouvrir Limbus' })).toBeHidden()
})

// EPIC-013 (US-061) : inscription fermée (réglage de la production) : ni lien sur l'écran de connexion, ni formulaire.
// Le serveur des tests l'ouvre : la réponse « fermée » est simulée côté navigateur, où les deux écrans la lisent.
test('inscription fermée : ni lien ni formulaire', async ({ page }) => {
  await page.route('**/api/auth/signup', (route) => route.request().method() === 'GET'
    ? route.fulfill({ json: { open: false } })
    : route.continue())
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Créer un compte' })).toBeHidden()

  await page.goto('/acces/inscription')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('L’inscription n’est pas ouverte pour le moment.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Créer mon compte' })).toBeHidden()
})

// US-246 (SPEC-022 R9 à R11, ADR-0088) : une personne dont une équipe a créé la fiche active le compte de son adresse
test('activer mon compte : la page envoie le lien, qui active le compte et ouvre « Je participe » (US-246)', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const name = uniqueName('Activée')
    const email = `${slugOf(name)}@example.test`
    const owner = await testUser(prisma, 'Équipe de l’activée')
    const title = uniqueName('Jeu de l’activée')
    const game = await prisma.game.create({ data: { title, slug: slugOf(title), description: '', ownerId: owner.user.id } })
    const account = await prisma.user.create({ data: { email, name: '', password: null, emailConfirmedAt: null } })
    await prisma.participant.create({ data: { slug: slugOf(uniqueName('fiche activee')), email, userId: account.id, gameLinks: { create: { gameId: game.id, name: 'Nom chez l’équipe' } } } })

    // Le lien depuis l'écran de connexion, puis la même réponse pour une adresse inconnue
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: 'Activer mon compte' }).click()
    await expect(page.getByRole('heading', { name: 'Activer mon compte' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    const unknown = `${slugOf(uniqueName('inconnue'))}@example.test`
    await page.getByLabel('Email').fill(unknown)
    await page.getByRole('button', { name: 'Recevoir le lien' }).click()
    await expect(page.getByText(`Si un compte attend à l’adresse ${unknown}, un lien pour l’activer vient d’y partir.`)).toBeVisible()

    await page.goto('/acces/activer')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Recevoir le lien' }).click()
    await expect(page.getByText(`Si un compte attend à l’adresse ${email}, un lien pour l’activer vient d’y partir.`)).toBeVisible()
    await expect.poll(() => mailbox.to(email).length).toBe(1)
    expect(mailbox.to(unknown)).toEqual([])
    const token = linkToken(mailbox.to(email)[0]!, '/acces/activer/')

    // Erreurs de saisie : rien n'est activé
    await page.goto(`/acces/activer/${token}`)
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Nom').fill(name)
    await page.getByLabel('Mot de passe', { exact: true }).fill('secret-activation-1')
    await page.getByLabel('Confirmation').fill('secret-different-1')
    await page.getByRole('button', { name: 'Activer et me connecter' }).click()
    await expect(page.getByText('Les deux mots de passe ne correspondent pas.')).toBeVisible()
    await page.getByLabel('Confirmation').fill('secret-activation-1')
    await page.getByRole('button', { name: 'Activer et me connecter' }).click()
    await expect(page.getByText('Acceptez les conditions d’utilisation pour créer votre compte.')).toBeVisible()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).emailConfirmedAt).toBeNull()

    // Conditions acceptées : le compte est activé, la personne arrive dans « Je participe »
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Activer et me connecter' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Je participe' })).toBeVisible()
    await expect(page.getByText(title).first()).toBeVisible()
    expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id }, select: { name: true } })).toEqual({ name })

    // Le lien ne sert qu'une fois : la page le dit, et propose d'en demander un autre
    await page.context().clearCookies()
    await page.goto(`/acces/activer/${token}`)
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Nom').fill(name)
    await page.getByLabel('Mot de passe', { exact: true }).fill('encore-un-secret-1')
    await page.getByLabel('Confirmation').fill('encore-un-secret-1')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Activer et me connecter' }).click()
    await expect(page.getByText('Ce lien n’est plus valable : il a déjà servi ou a été remplacé par un plus récent.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Demander un nouveau lien' })).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// US-246 : « Mot de passe oublié » sur un compte pré-créé envoie le lien d'activation, qui ouvre la page d'activation
test('mot de passe oublié sur un compte pré-créé : le lien reçu est celui de l’activation (US-246)', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const email = `${slugOf(uniqueName('oubli pre-cree'))}@example.test`
    await prisma.user.create({ data: { email, name: '', password: null, emailConfirmedAt: null } })
    await page.goto('/acces/mot-de-passe-oublie')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Recevoir le lien' }).click()
    await expect(page.getByText(`Si un compte utilise ${email}, un lien vient d’y partir.`)).toBeVisible()
    await expect.poll(() => mailbox.to(email).length).toBe(1)
    const token = linkToken(mailbox.to(email)[0]!, '/acces/activer/')
    await page.goto(`/acces/activer/${token}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Activer et me connecter' })).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
