// US-203 (EPIC-050, lot 6, 1/2) : les règles du vivier et de la sélection sans test de bout en bout (SPEC-001, SPEC-018),
// sur les quatre axes (ADR-0079) : actions, erreurs de saisie, droits, hors ligne
import { labelled } from './helpers'
import { createHash, randomBytes } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from '../../utils/registrationForms'
import { createTestPrisma } from '../integration/db'
import { openMailbox } from './mailbox'
import { E2E_USERS } from './constants'
import { gamePanel, openRegistrations, orgaGame, orgaSession, registrationTab, signIn, slugOf, test, type TestPrisma, testUser, uniqueName } from './helpers'
import type { RegistrationSessionStatus } from '~/generated/prisma/enums'
import { withFicheValues } from '../fiche'

type Line = { status: RegistrationSessionStatus, answer?: 'available' | 'unavailable', waitlistPosition?: number, announcedStatus?: RegistrationSessionStatus }

// Jeu propre au test, avec ses personnages PJ (les places), une session à venir et son vivier ouvert
async function vivier(prisma: TestPrisma, base: string, options: { seats?: number, sessionData?: { selectionMode?: 'chosen' | 'random' | 'mixed', organizerPicks?: number, open?: boolean }, replayPolicy?: 'allowed' | 'flagged' | 'excluded', state?: 'open' | 'closed', date?: Date | null } = {}) {
  const game = await orgaGame(prisma, base)
  for (let index = 0; index < (options.seats ?? 2); index++) {
    const name = uniqueName(`PJ ${index + 1}`)
    await prisma.character.create({ data: { name, slug: slugOf(name), gameId: game.id, type: 'pj' } })
  }
  const session = await orgaSession(prisma, game.id, `Session de ${base}`, options.date === null ? {} : { date: options.date ?? new Date('2099-06-01T09:00:00Z') })
  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: game.id, publicId: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, state: options.state ?? 'open', replayPolicy: options.replayPolicy ?? 'allowed',
      sessions: { create: { sessionId: session.id, open: options.sessionData?.open ?? true, selectionMode: options.sessionData?.selectionMode ?? 'chosen', organizerPicks: options.sessionData?.organizerPicks } }
    }
  })
  return { game, session, period }
}

// Personne du vivier, avec sa ligne pour la session et son lien personnel
async function member(prisma: TestPrisma, ctx: { game: { id: string }, session: { id: string }, period: { id: string } }, base: string, line?: Line) {
  const name = uniqueName(base)
  const email = `${slugOf(name)}@example.test`
  const token = randomBytes(32).toString('base64url')
  const participant = await withFicheValues(prisma.participant.create({ data: { slug: slugOf(name), email, gameLinks: { create: { gameId: ctx.game.id , name: name } } } }), { name: name })
  const registration = await prisma.registration.create({
    data: {
      gameId: ctx.game.id, periodId: ctx.period.id, participantId: participant.id, status: 'received', source: 'form', email,
      firstName: base, lastName: 'Test', phone: '0611111111', emergencyContactName: 'Urgence', emergencyContactPhone: '0622222222', charterAcceptedAt: new Date(),
      links: { create: { tokenHash: createHash('sha256').update(token).digest('hex') } },
      ...(line ? { sessionLines: { create: { sessionId: ctx.session.id, answer: line.status === 'unavailable' ? 'unavailable' : 'available', ...line } } } : {})
    }
  })
  return { name, email, token, participant, registration }
}

const sessionLine = (prisma: TestPrisma, registrationId: string, sessionId: string) =>
  prisma.registrationSession.findUnique({ where: { registrationId_sessionId: { registrationId, sessionId } }, select: { status: true, waitlistPosition: true } })

async function openSelection(page: Page, game: { title: string }, session: { label: string }) {
  await openRegistrations(page, game.title)
  const panel = gamePanel(page, game.title, 'Sélection')
  return { panel, block: panel.locator(`[data-session="${session.label}"]`) }
}

test.describe('sessions proposées et places', () => {
  test('une session sans date ne s’ouvre pas à la pré-inscription', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier sans date', { date: null, sessionData: { open: false } })
      await signIn(page, prisma, E2E_USERS.orga)
      const { block } = await openSelection(page, ctx.game, ctx.session)
      const open = block.getByRole('button', { name: 'Ouvrir à la pré-inscription' })
      await expect(open).toBeDisabled()
      await expect(open).toHaveAttribute('title', 'Seule une session datée et à venir peut être ouverte')
      await expect(block.getByText('Pas proposée au vivier')).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une session complète ne retient plus personne, et le surnombre est signalé', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier complet', { seats: 1 })
      await member(prisma, ctx, 'Retenue', { status: 'retained' })
      const waiting = await member(prisma, ctx, 'Prete', { status: 'preregistered' })
      await signIn(page, prisma, E2E_USERS.orga)
      const { block } = await openSelection(page, ctx.game, ctx.session)
      await expect(block.getByText('1 / 1 place')).toBeVisible()
      const retain = block.locator('li').filter({ hasText: waiting.name }).getByRole('button', { name: 'Retenir' })
      await expect(retain).toBeDisabled()
      await expect(retain).toHaveAttribute('title', 'Session complète : créez un personnage pour ajouter une place')

      // Un personnage supprimé ne retire personne : la session en surnombre est signalée (R8)
      await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: waiting.registration.id, sessionId: ctx.session.id } }, data: { status: 'retained' } })
      await openRegistrations(page, ctx.game.title)
      await expect(gamePanel(page, ctx.game.title, 'Sélection').locator(`[data-session="${ctx.session.label}"]`).getByText('Cette session est en surnombre : 2 personnes pour 1 personnages PJ.')).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('sélection', () => {
  test('en mode mixte, chaque organisatrice retient dans sa limite, puis le tirage complète', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier mixte', { seats: 3 })
      const people = []
      for (const base of ['Ada', 'Bea', 'Cid', 'Dan']) people.push(await member(prisma, ctx, base, { status: 'preregistered' }))
      await signIn(page, prisma, E2E_USERS.orga)
      const { panel, block } = await openSelection(page, ctx.game, ctx.session)

      // Réglage : un nombre de places choisies invalide est refusé, puis le mode mixte s'enregistre
      await block.getByRole('button', { name: 'Sélection' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('combobox').first().click()
      await page.getByRole('option', { name: 'Mixte' }).click()
      await dialog.getByLabel('Places choisies par organisatrice').fill('-1')
      await dialog.getByRole('button', { name: 'Enregistrer' }).click()
      // Le message de Limbus, et non la bulle du navigateur (US-220)
      await expect(dialog.getByText('Indiquez un nombre entre 0 et 1000.')).toBeVisible()
      await dialog.getByLabel('Places choisies par organisatrice').fill('1')
      await dialog.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(dialog).toBeHidden()
      await expect(block.getByText('Mode mixte : avant le tirage, chaque organisatrice retient jusqu’à 1 personne ; le tirage remplit le reste.')).toBeVisible()

      await block.locator('li').filter({ hasText: people[0]!.name }).getByRole('button', { name: 'Retenir' }).click()
      await expect(block.getByText('1 / 3 places')).toBeVisible()
      await block.locator('li').filter({ hasText: people[1]!.name }).getByRole('button', { name: 'Retenir' }).click()
      await expect(panel.getByText('Mode mixte : vous avez déjà retenu 1 personne pour cette session (1 au plus par organisatrice avant le tirage).')).toBeVisible()
      expect((await sessionLine(prisma, people[1]!.registration.id, ctx.session.id))?.status).toBe('preregistered')

      page.once('dialog', (confirmation) => confirmation.accept())
      await block.getByRole('button', { name: 'Tirer au sort' }).click()
      await expect(block.getByText('3 / 3 places')).toBeVisible()
      expect((await sessionLine(prisma, people[0]!.registration.id, ctx.session.id))?.status).toBe('retained')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('la liste d’attente se réordonne, et une place libre propose la première', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier attente', { seats: 1 })
      const placed = await member(prisma, ctx, 'Placee', { status: 'retained' })
      const first = await member(prisma, ctx, 'Premiere', { status: 'waitlisted', waitlistPosition: 1 })
      const second = await member(prisma, ctx, 'Seconde', { status: 'waitlisted', waitlistPosition: 2 })
      await signIn(page, prisma, E2E_USERS.orga)
      let { block } = await openSelection(page, ctx.game, ctx.session)

      await block.locator('li').filter({ hasText: first.name }).getByRole('button', { name: 'Descendre' }).click()
      await expect(block.locator('ol li').first()).toContainText(second.name)
      // Rouverte (filtrée sur le jeu) : l'ordre est enregistré
      await openRegistrations(page, ctx.game.title)
      block = gamePanel(page, ctx.game.title, 'Sélection').locator(`[data-session="${ctx.session.label}"]`)
      await expect(block.locator('ol li').first()).toContainText(second.name)

      // La place se libère : l'écran propose la première de la file, qui est retenue d'un clic
      await block.locator('li').filter({ hasText: placed.name }).getByRole('button', { name: 'Changer' }).click()
      await page.getByRole('menuitem', { name: 'Retirer du cast' }).click()
      await expect(block.getByText(`Une place est libre : retenir ${second.name}, première de la liste d’attente ?`)).toBeVisible()
      await block.getByRole('button', { name: 'Retenir' }).first().click()
      await expect.poll(async () => (await sessionLine(prisma, second.registration.id, ctx.session.id))?.status).toBe('retained')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('un rejoueur exclu ne reçoit pas de demande ni n’entre dans le tirage, mais se retient à la main', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier rejoueurs', { seats: 3, replayPolicy: 'excluded', sessionData: { selectionMode: 'random' } })
      const replayer = await member(prisma, ctx, 'Rejoueur', { status: 'preregistered' })
      const newcomer = await member(prisma, ctx, 'Nouvelle', { status: 'preregistered' })
      await member(prisma, ctx, 'Sans reponse')
      const past = await orgaSession(prisma, ctx.game.id, 'Session jouée', { date: new Date('2020-01-01T09:00:00Z'), status: 'completed' })
      await prisma.sessionParticipant.create({ data: { sessionId: past.id, participantId: replayer.participant.id, role: 'participant' } })
      await signIn(page, prisma, E2E_USERS.orga)
      const { panel, block } = await openSelection(page, ctx.game, ctx.session)

      await expect(panel.getByText('Les rejoueurs ne reçoivent pas de demande et n’entrent pas dans le tirage ; vous pouvez les retenir à la main.')).toBeVisible()
      await expect(block.locator('li').filter({ hasText: replayer.name }).getByText('A déjà joué')).toBeVisible()
      // Seule la personne sans réponse, et pas le rejoueur, recevrait la demande
      await expect(block.getByRole('button', { name: /Demander au vivier \(1\)/ })).toBeVisible()

      page.once('dialog', (confirmation) => confirmation.accept())
      await block.getByRole('button', { name: 'Tirer au sort' }).click()
      await block.getByText('Tirages : 1').click()
      await expect(panel.getByText('1 rejoueur exclu')).toBeVisible()
      expect((await sessionLine(prisma, newcomer.registration.id, ctx.session.id))?.status).toBe('retained')
      expect((await sessionLine(prisma, replayer.registration.id, ctx.session.id))?.status).toBe('preregistered')

      await block.locator('li').filter({ hasText: replayer.name }).getByRole('button', { name: 'Retenir' }).click()
      await expect.poll(async () => (await sessionLine(prisma, replayer.registration.id, ctx.session.id))?.status).toBe('retained')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une personne qui a répondu « pas disponible » s’ajoute à la main, et l’écran le signale', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier refus ajouté')
      const refused = await member(prisma, ctx, 'Refus', { status: 'unavailable' })
      await signIn(page, prisma, E2E_USERS.orga)
      const { block } = await openSelection(page, ctx.game, ctx.session)
      await block.getByRole('button', { name: 'Ajouter une autre personne du vivier…' }).click()
      await page.getByRole('option', { name: `${refused.name} (a répondu « pas disponible »)` }).click()
      const row = block.locator('li').filter({ hasText: refused.name })
      await expect(row.getByText('A répondu « pas disponible »')).toBeVisible()
      expect((await sessionLine(prisma, refused.registration.id, ctx.session.id))?.status).toBe('retained')
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('réglages des inscriptions (US-220)', () => {
  test('délai du vivier, prolongation sans date et adresse d’invitation refusés avec le message de Limbus', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier réglages refusés')
      const announced = await member(prisma, ctx, 'A prolonger', { status: 'retained', announcedStatus: 'retained' })
      await prisma.registrationSession.update({
        where: { registrationId_sessionId: { registrationId: announced.registration.id, sessionId: ctx.session.id } },
        data: { announcedAt: new Date(), responseDueAt: new Date('2099-05-01T09:00:00Z') }
      })
      await signIn(page, prisma, E2E_USERS.orga)
      const { block } = await openSelection(page, ctx.game, ctx.session)

      await registrationTab(page, 'Réglages')
      await page.getByRole('main').getByRole('button', { name: 'Réglages', exact: true }).click()
      let dialog = page.getByRole('dialog')
      await dialog.getByLabel('Délai de réponse (jours)').fill('0')
      await dialog.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(dialog.getByText('Entre 1 et 90 jours.')).toBeVisible()
      await dialog.getByRole('button', { name: 'Annuler' }).click()
      expect((await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: ctx.period.id } })).responseDelayDays).toBe(7)
      await registrationTab(page, 'Sessions')

      await block.locator('li').filter({ hasText: announced.name }).getByRole('button', { name: 'Prolonger' }).click()
      dialog = page.getByRole('dialog')
      await dialog.getByLabel('Nouvelle échéance').fill('')
      await dialog.getByRole('button', { name: 'Prolonger' }).click()
      await expect(dialog.getByText('Choisissez la nouvelle échéance.')).toBeVisible()
      await dialog.getByRole('button', { name: 'Annuler' }).click()

      await registrationTab(page, 'Vivier')
      await page.getByRole('main').getByRole('button', { name: 'Inviter', exact: true }).click()
      dialog = page.getByRole('dialog')
      await dialog.getByPlaceholder('Nom').fill('Sans arobase')
      await dialog.getByPlaceholder('Email').fill('adresse-sans-arobase')
      await dialog.getByRole('button', { name: /^Inviter/ }).click()
      await expect(dialog.getByText(/Email invalide|Adresse invalide/i)).toBeVisible()
      expect(await prisma.participantGame.count({ where: { name: 'Sans arobase', gameId: ctx.game.id } })).toBe(0)
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('« Pas disponible » par le lien de la demande', () => {
  const unavailableLink = (token: string, sessionId: string) => `/inscription/${token}?session=${sessionId}&reponse=indisponible`

  test('en attente, elle sort de la file ; retenue sans annonce, elle est retirée sans l’apprendre, et l’équipe est prévenue', async ({ page }) => {
    const prisma = createTestPrisma()
    const mailbox = openMailbox()
    try {
      const ctx = await vivier(prisma, 'Vivier refus file')
      const waiting = await member(prisma, ctx, 'Attente', { status: 'waitlisted', waitlistPosition: 1 })
      const retained = await member(prisma, ctx, 'Gardee', { status: 'retained' })

      await page.goto(unavailableLink(waiting.token, ctx.session.id))
      await page.getByRole('button', { name: 'Confirmer : pas disponible' }).click()
      await expect(page.getByText('Votre réponse est enregistrée.')).toBeVisible()
      expect(await sessionLine(prisma, waiting.registration.id, ctx.session.id)).toEqual({ status: 'unavailable', waitlistPosition: null })

      await page.goto(unavailableLink(retained.token, ctx.session.id))
      await page.getByRole('button', { name: 'Confirmer : pas disponible' }).click()
      await expect(page.getByText('Votre réponse est enregistrée.')).toBeVisible()
      await expect(page.getByText(/retenue|votre place/i)).toBeHidden()
      expect((await sessionLine(prisma, retained.registration.id, ctx.session.id))?.status).toBe('unavailable')
      await expect.poll(() => mailbox.to(E2E_USERS.orga).filter((mail) => mail.text.includes(retained.name)).length).toBeGreaterThan(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('retenue et annoncée, sa place reste, et la page la renvoie vers l’annulation', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier refus annoncé')
      const announced = await member(prisma, ctx, 'Annoncee', { status: 'retained', announcedStatus: 'retained' })
      await prisma.registrationSession.update({
        where: { registrationId_sessionId: { registrationId: announced.registration.id, sessionId: ctx.session.id } },
        data: { announcedAt: new Date(), responseDueAt: new Date('2099-05-01T09:00:00Z') }
      })
      await page.goto(unavailableLink(announced.token, ctx.session.id))
      await page.getByRole('button', { name: 'Confirmer : pas disponible' }).click()
      await expect(page.getByText('Vous avez une place pour cette session : votre réponse ne la change pas. Si vous ne pouvez plus venir, annulez votre présence ci-dessous.')).toBeVisible()
      expect((await sessionLine(prisma, announced.registration.id, ctx.session.id))?.status).toBe('retained')
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('réponses de la personne', () => {
  test('vivier fermé, une personne déjà dedans modifie encore ses réponses', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier fermé', { state: 'closed' })
      const person = await member(prisma, ctx, 'Fidele', { status: 'preregistered' })
      await page.goto(`/inscription/${person.token}`)
      await page.waitForLoadState('networkidle')
      await page.getByLabel('Prénom').fill('Fidèle')
      await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
      await expect(page.getByText('Vos modifications sont enregistrées.')).toBeVisible()
      expect((await prisma.registration.findUniqueOrThrow({ where: { id: person.registration.id } })).firstName).toBe('Fidèle')
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une question obligatoire ajoutée depuis sa réponse est exigée quand elle enregistre', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier nouvelle question')
      const person = await member(prisma, ctx, 'Revient', { status: 'preregistered' })
      // Le formulaire du jeu gagne une question obligatoire après sa réponse (faite sans version)
      await prisma.registrationForm.create({
        data: { gameId: ctx.game.id, versions: { create: { number: 1, definition: { ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: [{ id: 'nouvelle', label: 'Votre style de jeu', type: 'text', required: true }] } } } }
      })
      await page.goto(`/inscription/${person.token}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByLabel(/Votre style de jeu/)).toBeVisible()
      await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
      await expect(page.getByText('Certaines informations sont manquantes ou incorrectes.')).toBeVisible()

      await page.getByLabel(/Votre style de jeu/).fill('Enquête')
      await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
      await expect(page.getByText('Vos modifications sont enregistrées.')).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('invitée pour une session complète, elle reste pré-inscrite et l’équipe est prévenue', async ({ page }) => {
    const prisma = createTestPrisma()
    const mailbox = openMailbox()
    try {
      const ctx = await vivier(prisma, 'Invitation complète', { seats: 1 })
      await member(prisma, ctx, 'Deja la', { status: 'retained' })
      const invited = await member(prisma, ctx, 'Tardive')
      await prisma.registration.update({ where: { id: invited.registration.id }, data: { status: 'invited', source: 'invitation', charterAcceptedAt: null, invitedSessionId: ctx.session.id, invitationSentAt: new Date() } })

      await page.goto(`/inscription/${invited.token}`)
      await page.waitForLoadState('networkidle')
      await page.getByLabel(new RegExp(`^${ctx.session.label}`)).check()
      await page.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
      await page.getByRole('button', { name: 'Envoyer mes réponses' }).click()
      await expect(page.getByText('Vos réponses sont enregistrées.')).toBeVisible()
      await expect(page.locator(`[data-session="${ctx.session.label}"]`).getByText('Pré-inscrite')).toBeVisible()
      expect((await sessionLine(prisma, invited.registration.id, ctx.session.id))?.status).toBe('preregistered')
      await expect.poll(() => mailbox.to(E2E_USERS.orga).filter((mail) => mail.text.includes(invited.name)).length).toBeGreaterThan(0)
    } finally {
      await prisma.$disconnect()
    }
  })

  test('invitée pour une session annulée depuis, elle entre seulement dans le vivier', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Invitation annulée')
      const invited = await member(prisma, ctx, 'Patiente')
      await prisma.registration.update({ where: { id: invited.registration.id }, data: { status: 'invited', source: 'invitation', charterAcceptedAt: null, invitedSessionId: ctx.session.id, invitationSentAt: new Date() } })
      await prisma.session.update({ where: { id: ctx.session.id }, data: { status: 'cancelled' } })

      await page.goto(`/inscription/${invited.token}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByLabel(new RegExp(`^${ctx.session.label}`))).toBeHidden()
      await page.getByLabel('J’ai lu la note d’intention et j’y adhère').check()
      await page.getByRole('button', { name: 'Envoyer mes réponses' }).click()
      await expect(page.getByText('Vos réponses sont enregistrées.')).toBeVisible()
      expect((await prisma.registration.findUniqueOrThrow({ where: { id: invited.registration.id } })).status).toBe('received')
      expect(await sessionLine(prisma, invited.registration.id, ctx.session.id)).toBeNull()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('une personne invitée décline, et son lien ne permet plus rien', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier décliné')
      const invited = await member(prisma, ctx, 'Invitee')
      await prisma.registration.update({ where: { id: invited.registration.id }, data: { status: 'invited', source: 'invitation', charterAcceptedAt: null, invitationSentAt: new Date(), responseDueAt: new Date('2099-05-01T09:00:00Z') } })
      await page.goto(`/inscription/${invited.token}`)
      await page.waitForLoadState('networkidle')
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Décliner l’invitation' }).click()
      await expect(page.getByText('Vous avez décliné l’invitation. Ce lien ne permet plus rien.', { exact: false })).toBeVisible()
      expect((await prisma.registration.findUniqueOrThrow({ where: { id: invited.registration.id } })).status).toBe('withdrawn')
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('paiements et report (SPEC-018, R30)', () => {
  test('une inscrite partie puis remboursée passe en annulation', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier remboursement')
      const person = await member(prisma, ctx, 'Remboursee', { status: 'confirmed' })
      await prisma.sessionPayment.create({ data: { gameId: ctx.game.id, sessionId: ctx.session.id, participantId: person.participant.id, paidAt: new Date() } })
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(`/sessions/${ctx.session.slug}?tab=payments`)
      await page.waitForLoadState('networkidle')
      const departure = page.locator('section').filter({ hasText: 'Paiements de personnes parties' }).locator('article').filter({ hasText: person.name })
      await expect(departure).toBeVisible()
      await departure.getByRole('combobox').first().click()
      await page.getByRole('option', { name: /^Remboursé$/ }).click()
      await expect.poll(async () => (await sessionLine(prisma, person.registration.id, ctx.session.id))?.status).toBe('cancelled')

      await page.goto(`/inscription/${person.token}`)
      await expect(page.locator(`[data-session="${ctx.session.label}"]`).getByText('Annulation')).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })

  test('au report, une inscrite passe en « transférée » sur l’ancienne session et garde sa place sur la nouvelle', async ({ page }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier report')
      const person = await member(prisma, ctx, 'Reportee', { status: 'confirmed' })
      await prisma.sessionParticipant.create({ data: { sessionId: ctx.session.id, participantId: person.participant.id, role: 'participant' } })
      await signIn(page, prisma, E2E_USERS.orga)
      await page.goto(`/sessions/${ctx.session.slug}`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Reporter' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Reporter' }).click()
      // Sans nom (SPEC-021) : la nouvelle session se retrouve par le report
      await expect.poll(async () => (await prisma.session.findUniqueOrThrow({ where: { id: ctx.session.id }, select: { postponedToSessionId: true } })).postponedToSessionId).toBeTruthy()
      const { postponedToSessionId } = await prisma.session.findUniqueOrThrow({ where: { id: ctx.session.id }, select: { postponedToSessionId: true } })
      const created = await labelled(prisma, await prisma.session.findUniqueOrThrow({ where: { id: postponedToSessionId! } }))
      await expect(page.getByRole('heading', { name: created.label, level: 1 })).toBeVisible()
      expect((await sessionLine(prisma, person.registration.id, ctx.session.id))?.status).toBe('transferred')
      expect((await sessionLine(prisma, person.registration.id, created.id))?.status).toBe('confirmed')
      await page.goto(`/inscription/${person.token}`)
      await expect(page.getByText('Cette session est reportée : votre place est passée à la nouvelle session.')).toBeVisible()
    } finally {
      await prisma.$disconnect()
    }
  })
})

test.describe('droits et hors ligne', () => {
  test('une co-organisatrice retient comme la propriétaire ; une organisatrice sans accès ne voit pas le vivier', async ({ page, otherPage }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier partagé')
      const person = await member(prisma, ctx, 'Choisie', { status: 'preregistered' })
      const { user: coOrga, email: coOrgaEmail } = await testUser(prisma, 'Co-orga vivier')
      await prisma.gameShare.create({ data: { gameId: ctx.game.id, userId: coOrga.id } })
      await signIn(page, prisma, coOrgaEmail)
      const { block } = await openSelection(page, ctx.game, ctx.session)
      await block.locator('li').filter({ hasText: person.name }).getByRole('button', { name: 'Retenir' }).click()
      await expect.poll(async () => (await sessionLine(prisma, person.registration.id, ctx.session.id))?.status).toBe('retained')

      const stranger = await otherPage()
      const { email: strangerEmail } = await testUser(prisma, 'Orga étrangère')
      await signIn(stranger, prisma, strangerEmail)
      await stranger.goto('/registrations')
      await stranger.waitForLoadState('networkidle')
      await expect(stranger.getByRole('heading', { name: ctx.game.title })).toBeHidden()
      const refused = await stranger.request.get(`/api/registration-periods/${ctx.period.id}/selection`)
      expect([403, 404]).toContain(refused.status())
    } finally {
      await prisma.$disconnect()
    }
  })

  test('hors ligne, la sélection déjà lue se relit, et une décision est refusée sans rien changer', async ({ page, context }) => {
    const prisma = createTestPrisma()
    try {
      const ctx = await vivier(prisma, 'Vivier hors ligne')
      const person = await member(prisma, ctx, 'Horsligne', { status: 'preregistered' })
      await signIn(page, prisma, E2E_USERS.orga)
      await openSelection(page, ctx.game, ctx.session)
      await page.getByRole('link', { name: 'Jeux' }).first().click()
      await expect(page.getByRole('heading', { name: 'Jeux', level: 1 })).toBeVisible()

      await context.setOffline(true)
      await page.getByRole('link', { name: 'Inscriptions' }).first().click()
      await page.getByRole('link', { name: ctx.game.title, exact: true }).click()
      const block = gamePanel(page, ctx.game.title, 'Sélection').locator(`[data-session="${ctx.session.label}"]`)
      await expect(block.locator('li').filter({ hasText: person.name })).toBeVisible()
      await block.locator('li').filter({ hasText: person.name }).getByRole('button', { name: 'Retenir' }).click()
      // Un seul message : la relecture du vivier reprend la copie de l'appareil (US-221)
      await expect(page.getByText(/Pas de réseau : cette action demande une connexion/)).toBeVisible()
      await expect(page.getByText(/Pas de réseau|pas été consultée|Impossible de charger/)).toHaveCount(1)
      await context.setOffline(false)
      expect((await sessionLine(prisma, person.registration.id, ctx.session.id))?.status).toBe('preregistered')
    } finally {
      await prisma.$disconnect()
    }
  })
})
