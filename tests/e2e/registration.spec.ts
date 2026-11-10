import { createHash, randomBytes } from 'node:crypto'
import { expect } from '@playwright/test'
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from '../../utils/registrationForms'
import { createTestPrisma } from '../integration/db'
import { personalLinkToken } from '../integration/smtp'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { expectLoggedIn, gamePanel, login, openRegistrations, signIn, test } from './helpers'
import type { RegistrationSessionStatus } from '~/generated/prisma/enums'

// US-164 : invitation pour une session → réponse par le lien personnel, disponible → présence dans la session
test('une personne invitée pour une session répond par son lien et y est inscrite', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    await login(page, E2E_USERS.orga)
    await expectLoggedIn(page)
    await openRegistrations(page, 'Jeu des inscriptions', 'Vivier')
    // Le panneau de ce jeu : les tests voisins ajoutent leurs propres jeux à la page, en parallèle
    await gamePanel(page, 'Jeu des inscriptions', 'Inviter').getByRole('button', { name: 'Inviter', exact: true }).click()
    await page.getByRole('dialog').getByRole('combobox').click()
    await page.getByRole('option', { name: /^Session de printemps/ }).click()
    await page.getByText('Camille Invitée').click()
    await page.getByRole('button', { name: 'Inviter (1)' }).click()
    await expect(page.getByText('1 invitation, 1 email envoyé.')).toBeVisible()

    await expect.poll(() => mailbox.to('camille.invitee@example.test').length).toBe(1)
    const token = personalLinkToken(mailbox.to('camille.invitee@example.test')[0]!)

    // La personne invitée n'a pas de compte : navigateur vierge
    const guest = await otherPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await expect(guest.getByRole('heading', { name: 'Jeu des inscriptions' })).toBeVisible()
    await expect(guest.getByText('Jouer ensemble, avec bienveillance.')).toBeVisible()
    await expect(guest.getByLabel('Prénom')).toHaveValue('Camille')

    await guest.getByLabel('Nom', { exact: true }).fill('Invitée')
    await guest.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    await guest.getByLabel('Contact d’urgence : nom').fill('Dominique')
    await guest.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
    await guest.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await guest.getByLabel(/^Session de printemps/).check()
    await guest.getByRole('button', { name: 'Envoyer mes réponses' }).click()
    await expect(guest.getByText('Vos réponses sont enregistrées.')).toBeVisible()

    // L'organisatrice la retrouve dans la session et dans la sélection
    const session = await prisma.session.findUniqueOrThrow({ where: { slug: 'session-printemps' } })
    const participants = await (await page.request.get(`/api/sessions/${session.id}`)).json()
    expect(JSON.stringify(participants)).toContain('Camille Invitée')
    await openRegistrations(page, 'Jeu des inscriptions')
    await expect(page.getByRole('main').locator('li').filter({ hasText: 'Camille Invitée' }).getByText('Inscrite', { exact: true })).toBeVisible()

    // Elle entre dans le circuit de paiement sans attendre le casting (US-007, R22)
    await page.goto('/sessions/session-printemps?tab=payments')
    await expect(page.getByText('Camille Invitée').first()).toBeVisible()
    await expect(page.getByText('Personnage à attribuer')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-019 : questions propres au jeu et affinités, remplies par le lien personnel
test('la personne invitée répond aux questions du jeu et à ses affinités', async ({ otherPage }) => {
  const prisma = createTestPrisma()
  try {
    const key = `questions-e2e-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const definition = {
      standardFields: {
        lastName: { asked: false, required: false },
        firstName: { asked: true, required: false },
        facebookName: { asked: false, required: false },
        phone: { asked: false, required: false },
        emergencyContact: { asked: false, required: false },
        dietary: { asked: false, required: false }
      },
      affinities: { wantWith: { asked: true, required: true } },
      questions: [{ id: 'style', label: 'Ton style de jeu', type: 'single', required: true, options: ['Combat', 'Intrigue'] }]
    }
    const game = await prisma.game.create({
      data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id, noteIntention: 'Note', registrationForm: { create: { versions: { create: { number: 1, definition } } } } }
    })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-05-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `pub-${key}`, state: 'open', sessions: { create: { sessionId: session.id } } } })
    const participant = await prisma.participant.create({ data: { name: 'Lou Test', slug: `lou-${key}`, email: `lou-${key}@example.test`, gameLinks: { create: { gameId: game.id } } } })
    const token = randomBytes(32).toString('base64url')
    const registration = await prisma.registration.create({
      data: {
        gameId: period.gameId, periodId: period.id, invitedSessionId: session.id, participantId: participant.id, status: 'invited', source: 'invitation',
        email: participant.email!, links: { create: { tokenHash: createHash('sha256').update(token).digest('hex') } }, responseDueAt: new Date(Date.now() + 7 * 86_400_000)
      }
    })

    const guest = await otherPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await guest.getByLabel('Avec qui je veux jouer').fill('Léa\nNoé')
    await guest.getByLabel('Intrigue').check()
    await guest.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    // Ce formulaire ne les demande pas : contact d'urgence et allergies sont posés quand même (US-181)
    await expect(guest.getByLabel('Allergies et intolérances alimentaires')).toBeVisible()
    await guest.getByLabel('Contact d’urgence : nom').fill('Dominique')
    await guest.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
    await guest.getByRole('button', { name: 'Envoyer mes réponses' }).click()
    await expect(guest.getByText('Vos réponses sont enregistrées.')).toBeVisible()

    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, select: { questionAnswers: true, affinities: { select: { text: true }, orderBy: { position: 'asc' } } } })
    expect(saved.questionAnswers).toEqual({ style: 'Intrigue' })
    expect(saved.affinities.map((affinity) => affinity.text)).toEqual(['Léa', 'Noé'])
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-019 : l'éditeur ajoute une question à choix et active une affinité
test('l’éditeur du formulaire ajoute une question et une affinité', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const title = `Jeu éditeur ${Date.now()}`
    const game = await prisma.game.create({ data: { title, slug: `jeu-editeur-${Date.now()}`, description: '', ownerId: owner.id } })
    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, title)
    const panel = page.getByRole('main')
    await panel.getByRole('button', { name: 'Formulaire' }).click()

    const dialog = page.getByRole('dialog')
    // Contact d'urgence et allergies (5e et 6e champs) : toujours demandés, réglage figé (US-181)
    const asked = dialog.getByRole('checkbox', { name: 'Demandé', exact: true })
    await expect(asked.nth(3)).toBeEnabled()
    await expect(asked.nth(4)).toBeDisabled()
    await expect(asked.nth(5)).toBeDisabled()
    await dialog.getByRole('checkbox', { name: 'Demandée' }).first().check()
    await dialog.getByRole('button', { name: 'Ajouter une question' }).click()
    await dialog.getByLabel('Question', { exact: true }).fill('Ton style de jeu')
    await dialog.getByRole('combobox').last().click()
    await page.getByRole('option', { name: 'Choix unique' }).click()
    await dialog.getByLabel('Options', { exact: true }).fill('Combat\nIntrigue\n')
    // L'aperçu montre la question avant l'enregistrement
    await expect(dialog.getByText('Intrigue', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByText('Version 1 enregistrée.')).toBeVisible()

    const version = await prisma.registrationFormVersion.findFirstOrThrow({ where: { form: { gameId: game.id } } })
    const definition = version.definition as { affinities: Record<string, { asked: boolean }>, questions: Array<{ id: string, label: string, type: string, options: string[] }> }
    expect(definition.affinities.wantWith!.asked).toBe(true)
    expect(definition.questions).toEqual([expect.objectContaining({ label: 'Ton style de jeu', type: 'single', options: ['Combat', 'Intrigue'] })])
    expect(definition.questions[0]!.id).toBeTruthy()
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-042 (US-146) : le formulaire réel, rendu côté serveur, mélange ses options sans erreur d'hydratation, et la réponse suit le texte de l'option
test('une personne voit les options mélangées, et sa réponse suit le texte de l’option', async ({ otherPage }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const key = `melange-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id, noteIntention: 'Un jeu aux options mélangées.' } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-01-15T09:00:00Z') } })
    const options = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']
    await prisma.registrationForm.create({
      data: {
        gameId: game.id,
        versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'style', label: 'Ton style', type: 'single', required: true, options, shuffleOptions: true }] } } }
      }
    })
    const period = await prisma.registrationPeriod.create({
      data: { gameId: game.id, publicId: `m${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } }
    })

    const guest = await otherPage()
    const hydrationErrors: string[] = []
    guest.on('console', (message) => {
      if (/hydrat/i.test(message.text())) hydrationErrors.push(message.text())
    })
    guest.on('pageerror', (error) => hydrationErrors.push(error.message))
    await guest.goto(`/i/${period.publicId}`)
    await guest.waitForLoadState('networkidle')
    const order = () => guest.getByRole('radio').evaluateAll((radios) => radios.map((radio) => (radio as HTMLButtonElement).labels?.[0]?.textContent?.trim() ?? ''))
    const shown = await order()
    expect([...shown].sort()).toEqual(options)
    expect(shown).not.toEqual(options)
    expect(hydrationErrors).toEqual([])

    await guest.getByLabel('Email').fill(`marie-${key}@example.test`)
    await guest.getByLabel('Prénom').fill('Marie')
    await guest.getByLabel('Nom', { exact: true }).fill('Curie')
    await guest.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    await guest.getByLabel('Contact d’urgence : nom').fill('Pierre')
    await guest.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
    const chosen = shown[2]!
    await guest.getByRole('radio', { name: chosen }).click()
    expect(await order()).toEqual(shown)
    await guest.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await guest.getByRole('button', { name: 'M’inscrire' }).click()
    await expect(guest.getByText('Vérifiez votre boîte mail.')).toBeVisible()

    await expect.poll(() => mailbox.to(`marie-${key}@example.test`).length).toBe(1)
    await guest.goto(`/inscription/${personalLinkToken(mailbox.to(`marie-${key}@example.test`)[0]!)}`)
    await expect(guest.getByText('Votre adresse est confirmée : votre réponse est reçue.')).toBeVisible()
    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id }, select: { questionAnswers: true } })
    expect(registration.questionAnswers).toEqual({ style: chosen })
  } finally {
    await prisma.$disconnect()
  }
})

// US-163 : répondre par le lien de diffusion en cochant une session, confirmer son adresse, puis changer d'avis
test('une personne répond par le lien de diffusion, confirme son adresse et modifie ses disponibilités', async ({ otherPage }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const key = `diffusion-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id, noteIntention: 'Un jeu de diffusion.' } })
    const sessions = await Promise.all([1, 2].map((index) => prisma.session.create({
      data: { name: `Session ${index} ${key}`, slug: `session-${index}-${key}`, gameId: game.id, date: new Date(`2099-0${index}-15T09:00:00Z`) }
    })))
    const period = await prisma.registrationPeriod.create({
      data: { gameId: game.id, publicId: `d${Date.now().toString(36)}`, state: 'open', sessions: { create: sessions.map((session) => ({ sessionId: session.id, open: true })) } }
    })

    const guest = await otherPage()
    await guest.goto(`/i/${period.publicId}`)
    await guest.waitForLoadState('networkidle')
    await expect(guest.getByRole('heading', { name: game.title })).toBeVisible()
    await guest.getByLabel('Email').fill(`marie-${key}@example.test`)
    await guest.getByLabel('Prénom').fill('Marie')
    await guest.getByLabel('Nom', { exact: true }).fill('Curie')
    await guest.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    await guest.getByLabel('Contact d’urgence : nom').fill('Pierre')
    await guest.getByLabel('Contact d’urgence : téléphone').fill('0698765432')
    await guest.getByLabel(new RegExp(`^Session 2 ${key}`)).check()
    await guest.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await guest.getByRole('button', { name: 'M’inscrire' }).click()
    await expect(guest.getByText('Vérifiez votre boîte mail.')).toBeVisible()

    await expect.poll(() => mailbox.to(`marie-${key}@example.test`).length).toBe(1)
    const token = personalLinkToken(mailbox.to(`marie-${key}@example.test`)[0]!)
    await guest.goto(`/inscription/${token}`)
    await expect(guest.getByText('Votre adresse est confirmée : votre réponse est reçue.')).toBeVisible()

    const lines = () => prisma.registrationSession.findMany({ where: { registration: { periodId: period.id } }, select: { sessionId: true, status: true } })
    expect(await prisma.registration.findFirstOrThrow({ where: { periodId: period.id }, select: { status: true } })).toEqual({ status: 'received' })
    expect(await lines()).toEqual([{ sessionId: sessions[1]!.id, status: 'preregistered' }])
    await expect(guest.locator(`[data-session="${sessions[1]!.name}"]`).getByText('Pré-inscrite')).toBeVisible()

    // Elle revient : décocher vaut « pas disponible », et une date jamais cochée reste sans réponse
    await guest.reload()
    await guest.waitForLoadState('networkidle')
    await guest.getByLabel(new RegExp(`^Session 2 ${key}`)).uncheck()
    await guest.getByRole('button', { name: 'Enregistrer les modifications' }).click()
    await expect(guest.getByText('Vos modifications sont enregistrées.')).toBeVisible()
    await expect(guest.locator(`[data-session="${sessions[1]!.name}"]`).getByText('Pas disponible')).toBeVisible()
    expect(await lines()).toEqual([{ sessionId: sessions[1]!.id, status: 'unavailable' }])
  } finally {
    await prisma.$disconnect()
  }
})

// US-161 : l'équipe retient une pré-inscrite, annonce, et la personne confirme sa place par le lien reçu
test('l’équipe retient une pré-inscrite, l’annonce, et la personne confirme sa place', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const key = `selection-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-06-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({
      data: { gameId: game.id, publicId: `s${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } }
    })
    await prisma.character.create({ data: { name: 'Seul PJ', slug: `pj-${key}`, gameId: game.id, type: 'pj' } })
    const email = `noa-${key}@example.test`
    const participant = await prisma.participant.create({ data: { name: 'Noa Selection', slug: `noa-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
    const registration = await prisma.registration.create({
      data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email, links: { create: { tokenHash: `hash-${key}` } }, sessionLines: { create: { sessionId: session.id, status: 'preregistered', answer: 'available' } } }
    })

    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, game.title)
    const panel = gamePanel(page, game.title, 'Sélection')
    const sessionBlock = panel.locator(`[data-session="${session.name}"]`)
    await sessionBlock.locator('li').filter({ hasText: 'Noa Selection' }).getByRole('button', { name: 'Retenir' }).click()
    await expect(sessionBlock.getByText('À annoncer', { exact: true })).toBeVisible()
    await expect(sessionBlock.getByText('1 / 1 place')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await sessionBlock.getByRole('button', { name: 'Annoncer le casting (1)' }).click()
    await expect(panel.getByText('1 personne prévenue.')).toBeVisible()

    await expect.poll(() => mailbox.to(email).length).toBe(1)
    const token = personalLinkToken(mailbox.to(email)[0]!)
    const guest = await otherPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await guest.getByRole('button', { name: 'Je confirme ma place' }).click()
    await expect(guest.getByText('Votre place est confirmée.')).toBeVisible()

    expect(await prisma.registrationSession.findUniqueOrThrow({ where: { registrationId_sessionId: { registrationId: registration.id, sessionId: session.id } }, select: { status: true } })).toEqual({ status: 'confirmed' })
    await expect(guest.locator(`[data-session="${session.name}"]`).getByText('Inscrite')).toBeVisible()

    // Elle annule sa présence, et reste dans le vivier
    guest.once('dialog', (dialog) => dialog.accept())
    await guest.getByRole('button', { name: 'Annuler ma présence' }).click()
    await expect(guest.getByText('Votre présence est annulée.')).toBeVisible()
    await expect(guest.getByRole('button', { name: 'Quitter le vivier' })).toBeVisible()
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: registration.id, sessionId: session.id } }, data: { status: 'confirmed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(1)
  } finally {
    await prisma.$disconnect()
  }
})

// US-171 : l'équipe ouvre une session, la règle au hasard, tire au sort ; le journal garde le tirage, qu'on annule
test('l’équipe tire au sort, voit le journal, puis annule le tirage', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `tirage-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-07-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({
      data: { gameId: game.id, publicId: `t${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, selectionMode: 'random', waitlistSize: 1 } } }
    })
    await prisma.character.create({ data: { name: 'Seul PJ', slug: `pj-${key}`, gameId: game.id, type: 'pj' } })
    for (const name of ['Ana', 'Ben', 'Cy']) {
      const participant = await prisma.participant.create({ data: { name: `${name} Tirage`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } } })
      await prisma.registration.create({ data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email: participant.email!, sessionLines: { create: { sessionId: session.id, status: 'preregistered', answer: 'available' } } } })
    }

    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, game.title)
    const panel = gamePanel(page, game.title, 'Tirer au sort')
    page.once('dialog', (dialog) => dialog.accept())
    await panel.getByRole('button', { name: 'Tirer au sort' }).click()
    await expect(panel.getByText('Tirage effectué')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Annoncer le casting (1)' })).toBeVisible()
    // Le journal de la session est replié (SPEC-020, R8)
    await panel.getByText('Tirages : 1').click()
    await expect(panel.getByRole('button', { name: 'Annuler ce tirage' })).toBeVisible()

    const statuses = async () => (await prisma.registrationSession.findMany({ where: { sessionId: session.id }, select: { status: true } })).map((row) => row.status).sort()
    expect(await statuses()).toEqual(['preregistered', 'retained', 'waitlisted'])

    page.once('dialog', (dialog) => dialog.accept())
    await panel.getByRole('button', { name: 'Annuler ce tirage' }).click()
    await expect(panel.getByText(/Annulé le/)).toBeVisible()
    expect(await statuses()).toEqual(['preregistered', 'preregistered', 'preregistered'])
  } finally {
    await prisma.$disconnect()
  }
})


// EPIC-023 : l'équipe rattache une affinité à une personne suggérée, et la sélection affiche l'alerte
test('l’équipe rattache une affinité et voit l’alerte de la session', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `affinites-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-08-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({
      data: { gameId: game.id, publicId: `a${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id } } }
    })
    const people = await Promise.all(['Lou Affinite', 'Max Durand'].map((name, index) => prisma.participant.create({
      data: { name, slug: `${index}-${key}`, email: `${index}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
    })))
    for (const participant of people) {
      await prisma.registration.create({
        data: {
          gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email: participant.email!, respondedAt: new Date(),
          sessionLines: { create: { sessionId: session.id, status: 'retained' } },
          affinities: participant.name.startsWith('Lou') ? { create: { kind: 'avoid', text: 'Max D.', position: 0 } } : undefined
        }
      })
    }

    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, game.title)
    const panel = gamePanel(page, game.title, 'Sélection')
    await expect(panel.getByText('1 affinité à rattacher').first()).toBeVisible()
    await panel.locator(`[data-session="${session.name}"] li`).filter({ hasText: 'Lou Affinite' }).getByRole('button', { name: 'Détail' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Max Durand' }).click()
    await expect(dialog.getByText('À rattacher')).toBeHidden()
    await page.keyboard.press('Escape')

    await expect(panel.getByText('Lou Affinite ne veut pas croiser Max Durand.')).toBeVisible()
    await expect(panel.getByText('1 affinité à rattacher')).toBeHidden()
  } finally {
    await prisma.$disconnect()
  }
})

// EPIC-047 : l'équipe ouvre une session, la demande part sur son clic ; la personne confirme sa réponse depuis l'email
test('demander au vivier, répondre d’un clic, puis relancer', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const key = `demande-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-06-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `d${Date.now().toString(36)}`, state: 'open' } })
    await prisma.character.create({ data: { name: 'Seul PJ', slug: `pj-${key}`, gameId: game.id, type: 'pj' } })
    const person = async (name: string) => {
      const email = `${name.toLowerCase()}-${key}@example.test`
      const participant = await prisma.participant.create({ data: { name, slug: `${name.toLowerCase()}-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
      await prisma.registration.create({ data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email, respondedAt: new Date() } })
      return email
    }
    const noa = await person('Noa')
    const eli = await person('Eli')

    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, game.title)
    const panel = gamePanel(page, game.title, 'Sélection')
    const block = panel.locator(`[data-session="${session.name}"]`)

    // Ouvrir propose la demande, sans rien envoyer
    await block.getByRole('button', { name: 'Ouvrir à la pré-inscription' }).click()
    await expect(block.getByText('Rien ne part sans votre clic.')).toBeVisible()
    expect(mailbox.to(noa)).toHaveLength(0)

    page.once('dialog', (dialog) => dialog.accept())
    await block.getByRole('button', { name: 'Envoyer la demande' }).click()
    await expect(panel.getByText('2 emails envoyés.')).toBeVisible()
    await expect.poll(() => mailbox.to(noa).length).toBe(1)
    await expect.poll(() => mailbox.to(eli).length).toBe(1)

    // Le lien de l'email demande de confirmer : l'ouvrir n'écrit rien
    const link = /\/inscription\/[^\s]+reponse=disponible/.exec(mailbox.to(noa)[0]!.text)![0]
    await page.goto(link)
    const prompt = page.locator('[data-availability-prompt]')
    await expect(prompt.getByText(session.name)).toBeVisible()
    expect(await prisma.registrationSession.count({ where: { sessionId: session.id } })).toBe(0)
    await prompt.getByRole('button', { name: 'Confirmer : disponible' }).click()
    await expect(page.getByText('Votre réponse est enregistrée.')).toBeVisible()
    await expect(prompt).toHaveCount(0)
    expect(await prisma.registrationSession.findFirst({ where: { sessionId: session.id }, select: { status: true } })).toEqual({ status: 'preregistered' })

    // Une place déjà annoncée ne change pas, et la page renvoie vers l'annulation
    await prisma.registrationSession.updateMany({ where: { sessionId: session.id }, data: { status: 'confirmed', announcedStatus: 'retained', confirmedAt: new Date() } })
    const refusal = /\/inscription\/[^\s]+reponse=indisponible/.exec(mailbox.to(noa)[0]!.text)![0]
    await page.goto(refusal)
    await prompt.getByRole('button', { name: 'Confirmer : pas disponible' }).click()
    await expect(page.getByText('Vous avez une place pour cette session')).toBeVisible()
    expect(await prisma.registrationSession.findFirst({ where: { sessionId: session.id }, select: { status: true } })).toEqual({ status: 'confirmed' })

    // Session refermée : plus rien à confirmer pour une personne sans réponse
    await prisma.registrationPeriodSession.update({ where: { sessionId: session.id }, data: { open: false } })
    await page.goto(/\/inscription\/[^\s]+reponse=disponible/.exec(mailbox.to(eli)[0]!.text)![0])
    await expect(page.getByText('Cette session n’est plus proposée.')).toBeVisible()
    await expect(prompt).toHaveCount(0)
    await prisma.registrationPeriodSession.update({ where: { sessionId: session.id }, data: { open: true } })

    // Relancer écrit seulement à celle qui n'a pas répondu
    await openRegistrations(page, game.title)
    await expect(block.getByText(/1 réponse/)).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await block.getByRole('button', { name: 'Relancer (1)' }).click()
    await expect(panel.getByText('1 email envoyé.')).toBeVisible()
    await expect.poll(() => mailbox.to(eli).length).toBe(2)
    expect(mailbox.to(noa)).toHaveLength(1)
  } finally {
    await prisma.$disconnect()
  }
})

// US-166 : un envoi raté se signale par personne, et « Réessayer » n'écrit qu'à elle
test('réessayer une demande de disponibilités n’écrit qu’aux personnes en échec', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const key = `reessai-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-06-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `r${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } } })
    const person = async (name: string, email: string) => {
      const participant = await prisma.participant.create({ data: { name, slug: `${name.toLowerCase()}-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
      return await prisma.registration.create({ data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email, respondedAt: new Date() } })
    }
    const fine = `recoit-${key}@example.test`
    const failing = await person('Echoue', `refuse-echoue-${key}@example.test`)
    await person('Recoit', fine)

    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, game.title)
    const block = gamePanel(page, game.title, 'Sélection').locator(`[data-session="${session.name}"]`)
    page.once('dialog', (dialog) => dialog.accept())
    await block.getByRole('button', { name: 'Demander au vivier (2)' }).click()
    await expect(block.getByText('Demande non envoyée')).toBeVisible()
    await expect(block.getByText(/Echoue/)).toBeVisible()
    await expect.poll(() => mailbox.to(fine).length).toBe(1)

    const repaired = `repare-${key}@example.test`
    await prisma.registration.update({ where: { id: failing.id }, data: { email: repaired } })
    page.once('dialog', (dialog) => dialog.accept())
    await block.getByRole('button', { name: 'Réessayer' }).click()
    await expect(block.getByText('Demande non envoyée')).toHaveCount(0)
    await expect.poll(() => mailbox.to(repaired).length).toBe(1)
    expect(mailbox.to(fine)).toHaveLength(1)
  } finally {
    await prisma.$disconnect()
  }
})

// US-172 : après l'annonce, rien ne part seul ; la ligne propose un email, que l'équipe envoie ou ignore
test('après l’annonce du casting, chaque changement se propose personne par personne', async ({ page }) => {
  const prisma = createTestPrisma()
  const mailbox = openMailbox()
  try {
    const key = `annonce-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-06-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `a${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } } })
    await prisma.character.createMany({ data: [1, 2, 3].map((index) => ({ name: `PJ ${index}`, slug: `pj-${index}-${key}`, gameId: game.id, type: 'pj' })) })
    const person = async (name: string, status: RegistrationSessionStatus) => {
      const email = `${name.toLowerCase()}-${key}@example.test`
      const participant = await prisma.participant.create({ data: { name, slug: `${name.toLowerCase()}-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
      await prisma.registration.create({ data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email, respondedAt: new Date(), sessionLines: { create: { sessionId: session.id, status, answer: 'available' } } } })
      return email
    }
    const noa = await person('Noa', 'retained')
    const eli = await person('Eli', 'waitlisted')
    const sam = await person('Sam', 'preregistered')

    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, game.title)
    const block = gamePanel(page, game.title, 'Sélection').locator(`[data-session="${session.name}"]`)

    // Case décochée : la liste d'attente n'est pas prévenue
    await expect(block.getByText('Prévenir aussi la liste d’attente (1)')).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await block.getByRole('button', { name: 'Annoncer le casting (1)' }).click()
    await expect(block.getByText(/Casting annoncé le/)).toBeVisible()
    await expect.poll(() => mailbox.to(noa).length).toBe(1)
    expect(mailbox.to(eli)).toHaveLength(0)

    // Retenue après l'annonce : rien ne part, la ligne propose l'email
    await block.locator('li').filter({ hasText: 'Sam' }).getByRole('button', { name: 'Retenir' }).click()
    const proposals = block.locator('[data-announcement-proposals]')
    await expect(proposals.getByText('Sam')).toBeVisible()
    expect(mailbox.to(sam)).toHaveLength(0)
    await proposals.getByRole('button', { name: 'Envoyer l’email' }).click()
    await expect.poll(() => mailbox.to(sam).length).toBe(1)
    await expect(proposals).toHaveCount(0)

    // Sortie du cast : la proposition s'ignore
    await block.locator('li').filter({ hasText: 'Noa' }).getByRole('button', { name: 'Changer' }).click()
    await page.getByRole('menuitem', { name: 'Retirer du cast' }).click()
    await expect(proposals.getByText('Noa')).toBeVisible()
    await proposals.getByRole('button', { name: 'Ignorer' }).click()
    await expect(proposals).toHaveCount(0)
    expect(mailbox.to(noa)).toHaveLength(1)
  } finally {
    await prisma.$disconnect()
  }
})

// US-173 : une personne castée change ses réponses ; le repère apparaît, et disparaît une fois marqué comme lu
test('le repère « Réponses modifiées » se marque comme lu', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `modif-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-06-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `m${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } } })
    await prisma.character.create({ data: { name: 'Seul PJ', slug: `pj-${key}`, gameId: game.id, type: 'pj' } })
    const email = `noa-${key}@example.test`
    const participant = await prisma.participant.create({ data: { name: 'Noa Modif', slug: `noa-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
    await prisma.registration.create({ data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email, respondedAt: new Date(), sessionLines: { create: { sessionId: session.id, status: 'retained', answer: 'available', answersChangedAt: new Date() } } } })

    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, game.title)
    const block = gamePanel(page, game.title, 'Sélection').locator(`[data-session="${session.name}"]`)
    await expect(block.getByText('Réponses modifiées')).toBeVisible()
    await block.getByRole('button', { name: 'Marquer comme lu' }).click()
    await expect(block.getByText('Réponses modifiées')).toHaveCount(0)
    await expect.poll(async () => (await prisma.registrationSession.findFirst({ where: { sessionId: session.id }, select: { answersChangedAt: true } }))?.answersChangedAt).toBeNull()
  } finally {
    await prisma.$disconnect()
  }
})

// US-174 : « inscrite validée » se lit de la même façon côté équipe et côté personne, et suit le paiement
test('le parcours affiche « Inscrite validée » pour l’équipe et pour la personne', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  try {
    const key = `valide-${Date.now()}`
    const token = randomBytes(32).toString('base64url')
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-06-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `v${Date.now().toString(36)}`, state: 'open', sessions: { create: { sessionId: session.id, open: true } } } })
    await prisma.character.create({ data: { name: 'Seul PJ', slug: `pj-${key}`, gameId: game.id, type: 'pj' } })
    const email = `noa-${key}@example.test`
    const participant = await prisma.participant.create({ data: { name: 'Noa Valide', slug: `noa-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
    await prisma.registration.create({ data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email, respondedAt: new Date(), links: { create: { tokenHash: createHash('sha256').update(token).digest('hex') } }, sessionLines: { create: { sessionId: session.id, status: 'confirmed', confirmedAt: new Date(), announcedStatus: 'retained' } } } })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
    await prisma.sessionPayment.create({ data: { gameId: session.gameId, sessionId: session.id, participantId: participant.id, paidAt: new Date() } })

    await signIn(page, prisma, E2E_USERS.orga)
    await openRegistrations(page, game.title)
    await expect(gamePanel(page, game.title, 'Sélection').locator(`[data-session="${session.name}"]`).getByText('Inscrite validée')).toBeVisible()

    const guest = await otherPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await expect(guest.locator(`[data-session="${session.name}"]`).getByText('Inscrite validée')).toBeVisible()
  } finally {
    await prisma.$disconnect()
  }
})
