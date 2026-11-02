import { createHash, randomBytes } from 'node:crypto'
import { expect } from '@playwright/test'
import { createTestPrisma } from '../integration/db'
import { personalLinkToken, startTestSmtp } from '../integration/smtp'
import { E2E_USERS } from './constants'
import { expectLoggedIn, gamePanel, login, signIn, test } from './helpers'

// EPIC-001 : invitation par l'organisatrice → réponse par le lien personnel → présence dans la session
test('une personne invitée accepte par son lien et rejoint la session', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    await login(page, E2E_USERS.orga)
    await expectLoggedIn(page)
    await page.goto('/registrations')
    await page.getByRole('button', { name: 'Inviter', exact: true }).click()
    await page.getByText('Camille Invitée').click()
    await page.getByRole('button', { name: 'Inviter (1)' }).click()
    await expect(page.getByText('1 invitation, 1 email envoyé.')).toBeVisible()

    await expect.poll(() => smtp.received.length).toBe(1)
    const token = personalLinkToken(smtp.received[0]!)
    expect(smtp.received[0]!.to).toEqual(['camille.invitee@example.test'])

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
    await guest.getByRole('button', { name: 'Accepter l’invitation' }).click()
    await expect(guest.getByText('Votre inscription est confirmée.')).toBeVisible()

    // L'organisatrice la retrouve dans la session et dans la liste des inscriptions
    const session = await prisma.session.findUniqueOrThrow({ where: { slug: 'session-printemps' } })
    const participants = await (await page.request.get(`/api/sessions/${session.id}`)).json()
    expect(JSON.stringify(participants)).toContain('Camille Invitée')
    await page.goto('/registrations')
    await expect(page.getByText('Confirmée', { exact: true })).toBeVisible()

    // Elle entre dans le circuit de paiement sans attendre le casting (US-007, R22)
    await page.goto('/sessions/session-printemps?tab=payments')
    await expect(page.getByText('Camille Invitée').first()).toBeVisible()
    await expect(page.getByText('Personnage à attribuer')).toBeVisible()
  } finally {
    await smtp.stop()
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
    const period = await prisma.registrationPeriod.create({ data: { name: 'Période', gameId: game.id, publicId: `pub-${key}`, state: 'open', sessions: { create: { sessionId: session.id, seats: 3 } } } })
    const participant = await prisma.participant.create({ data: { name: 'Lou Test', slug: `lou-${key}`, email: `lou-${key}@example.test`, gameLinks: { create: { gameId: game.id } } } })
    const token = randomBytes(32).toString('base64url')
    const registration = await prisma.registration.create({
      data: {
        periodId: period.id, sessionId: session.id, participantId: participant.id, status: 'invited', source: 'invitation',
        email: participant.email!, tokenHash: createHash('sha256').update(token).digest('hex'), responseDueAt: new Date(Date.now() + 7 * 86_400_000)
      }
    })

    const guest = await otherPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await guest.getByLabel('Avec qui je veux jouer').fill('Léa\nNoé')
    await guest.getByLabel('Intrigue').check()
    await guest.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
    await guest.getByRole('button', { name: 'Accepter l’invitation' }).click()
    await expect(guest.getByText('Votre inscription est confirmée.')).toBeVisible()

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
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    const panel = gamePanel(page, title, 'Formulaire')
    await panel.getByRole('button', { name: 'Formulaire' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('checkbox', { name: 'Demandée' }).first().check()
    await dialog.getByRole('button', { name: 'Ajouter une question' }).click()
    await dialog.getByLabel('Question', { exact: true }).fill('Ton style de jeu')
    await dialog.getByRole('combobox').last().click()
    await page.getByRole('option', { name: 'Choix unique' }).click()
    await dialog.getByLabel('Options').fill('Combat\nIntrigue\n')
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

// EPIC-020 : s'inscrire par le lien de diffusion, puis confirmer son adresse par le lien reçu
test('une personne s’inscrit par le lien de diffusion et confirme son adresse', async ({ otherPage }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const key = `diffusion-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id, noteIntention: 'Un jeu de diffusion.' } })
    const sessions = await Promise.all([1, 2].map((index) => prisma.session.create({
      data: { name: `Session ${index} ${key}`, slug: `session-${index}-${key}`, gameId: game.id, date: new Date(`2099-0${index}-15T09:00:00Z`) }
    })))
    const period = await prisma.registrationPeriod.create({
      data: { name: 'Printemps', gameId: game.id, publicId: `d${Date.now().toString(36)}`, entryMode: 'form', state: 'open', sessions: { create: sessions.map((session) => ({ sessionId: session.id, seats: 3 })) } }
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

    await expect.poll(() => smtp.to(`marie-${key}@example.test`).length).toBe(1)
    const token = personalLinkToken(smtp.to(`marie-${key}@example.test`)[0]!)
    await guest.goto(`/inscription/${token}`)
    await expect(guest.getByText('Votre adresse est confirmée : votre inscription est reçue.')).toBeVisible()

    const registration = await prisma.registration.findFirstOrThrow({ where: { periodId: period.id }, select: { status: true, availabilities: { select: { sessionId: true } } } })
    expect(registration).toEqual({ status: 'received', availabilities: [{ sessionId: sessions[1]!.id }] })
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})

// EPIC-021 : l'équipe retient une inscription reçue, annonce, et la personne confirme sa place par le lien reçu
test('l’équipe retient une inscription, l’annonce, et la personne confirme sa place', async ({ page, otherPage }) => {
  const prisma = createTestPrisma()
  const smtp = await startTestSmtp(prisma)
  try {
    const key = `selection-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-06-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({
      data: { name: 'Été', gameId: game.id, publicId: `s${Date.now().toString(36)}`, entryMode: 'form', state: 'open', sessions: { create: { sessionId: session.id, seats: 2 } } }
    })
    const email = `noa-${key}@example.test`
    const participant = await prisma.participant.create({ data: { name: 'Noa Selection', slug: `noa-${key}`, email, gameLinks: { create: { gameId: game.id } } } })
    const registration = await prisma.registration.create({
      data: { periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email, tokenHash: `hash-${key}` }
    })

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    const panel = gamePanel(page, game.title, /Annoncer les résultats/)
    await panel.getByRole('button', { name: 'Décider' }).click()
    await page.getByRole('menuitem', { name: `Retenir pour ${session.name}` }).click()
    await expect(panel.getByText('À annoncer')).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await panel.getByRole('button', { name: 'Annoncer les résultats (1)' }).click()
    await expect(panel.getByText('1 personne prévenue.')).toBeVisible()

    await expect.poll(() => smtp.to(email).length).toBe(1)
    const token = personalLinkToken(smtp.to(email)[0]!)
    const guest = await otherPage()
    await guest.goto(`/inscription/${token}`)
    await guest.waitForLoadState('networkidle')
    await guest.getByRole('button', { name: 'Je confirme ma place' }).click()
    await expect(guest.getByText('Votre place est confirmée.')).toBeVisible()

    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, select: { status: true } })).toEqual({ status: 'confirmed' })
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(1)
  } finally {
    await smtp.stop()
    await prisma.$disconnect()
  }
})

// EPIC-022 : l'équipe tire au sort une période en mode hasard ; le journal garde le tirage, qu'on annule
test('l’équipe tire au sort, voit le journal, puis annule le tirage', async ({ page }) => {
  const prisma = createTestPrisma()
  try {
    const key = `tirage-${Date.now()}`
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USERS.orga } })
    const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, date: new Date('2099-07-01T09:00:00Z') } })
    const period = await prisma.registrationPeriod.create({
      data: { name: 'Hiver', gameId: game.id, publicId: `t${Date.now().toString(36)}`, entryMode: 'form', state: 'open', selectionMode: 'random', waitlistSize: 1, sessions: { create: { sessionId: session.id, seats: 1 } } }
    })
    for (const name of ['Ana', 'Ben', 'Cy']) {
      const participant = await prisma.participant.create({ data: { name: `${name} Tirage`, slug: `${name.toLowerCase()}-${key}`, email: `${name.toLowerCase()}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } } })
      await prisma.registration.create({ data: { periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email: participant.email! } })
    }

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    const panel = gamePanel(page, game.title, 'Tirer au sort')
    page.once('dialog', (dialog) => dialog.accept())
    await panel.getByRole('button', { name: 'Tirer au sort' }).click()
    await expect(panel.getByText('Tirage effectué')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Annoncer les résultats (3)' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Annuler ce tirage' })).toBeVisible()

    const statuses = (await prisma.registration.findMany({ where: { periodId: period.id }, select: { status: true } })).map((row) => row.status).sort()
    expect(statuses).toEqual(['rejected', 'retained', 'waitlisted'])

    page.once('dialog', (dialog) => dialog.accept())
    await panel.getByRole('button', { name: 'Annuler ce tirage' }).click()
    await expect(panel.getByText(/Annulé le/)).toBeVisible()
    expect((await prisma.registration.findMany({ where: { periodId: period.id }, select: { status: true } })).every((row) => row.status === 'received')).toBe(true)
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
      data: { name: 'Automne', gameId: game.id, publicId: `a${Date.now().toString(36)}`, entryMode: 'form', state: 'open', sessions: { create: { sessionId: session.id, seats: 5 } } }
    })
    const people = await Promise.all(['Lou Affinite', 'Max Durand'].map((name, index) => prisma.participant.create({
      data: { name, slug: `${index}-${key}`, email: `${index}-${key}@example.test`, gameLinks: { create: { gameId: game.id } } }
    })))
    for (const participant of people) {
      await prisma.registration.create({
        data: {
          periodId: period.id, participantId: participant.id, status: 'retained', sessionId: session.id, source: 'form', email: participant.email!, respondedAt: new Date(),
          affinities: participant.name.startsWith('Lou') ? { create: { kind: 'avoid', text: 'Max D.', position: 0 } } : undefined
        }
      })
    }

    await signIn(page, prisma, E2E_USERS.orga)
    await page.goto('/registrations')
    await page.waitForLoadState('networkidle')
    const panel = gamePanel(page, game.title, /Annoncer les résultats/)
    await expect(panel.getByText('1 affinité à rattacher')).toBeVisible()
    await panel.locator('li').filter({ hasText: 'Lou Affinite' }).getByRole('button', { name: 'Détail' }).click()
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
