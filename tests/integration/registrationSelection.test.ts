// EPIC-021 : trier les inscriptions (US-087), annoncer (US-088), confirmer sa place (US-089), vivier (US-090)
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { personalLinkToken, startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0
const DAY = 24 * 60 * 60 * 1000

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

// Chaque appel public part d'une IP à lui : la limite de débit ne mélange pas les tests
async function publicApi(method: string, path: string) {
  const headers = { 'x-forwarded-for': `10.30.${Math.floor(++counter / 250)}.${counter % 250}` }
  const response = await fetch(`${inject('baseUrl')}${path}`, { method, headers })
  return { status: response.status, body: await response.json().catch(() => null) as any }
}

// Un jeu d'Alice, ses sessions à venir, et une période en mode formulaire (ou l'inscription permanente)
async function aliceGame(options: { sessions?: number, seats?: number, permanent?: boolean, replayPolicy?: string } = {}) {
  const key = `selection-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const sessions = await Promise.all(Array.from({ length: options.sessions ?? 2 }, (_, index) => prisma.session.create({
    data: { name: `Session ${index + 1} ${key}`, slug: `session-${index + 1}-${key}`, gameId: game.id, date: new Date(Date.now() + (10 + index) * DAY) }
  })))
  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: game.id,
      name: `Période ${key}`,
      publicId: key,
      entryMode: 'form',
      scope: options.permanent ? 'game' : 'sessions',
      state: 'open',
      replayPolicy: options.replayPolicy ?? 'allowed',
      sessions: options.permanent ? undefined : { create: sessions.map((session) => ({ sessionId: session.id, seats: options.seats ?? 2 })) }
    }
  })
  return { key, game, sessions, period }
}

// Une inscription reçue par le formulaire, disponible pour les sessions données (R10)
async function received(game: { id: string }, period: { id: string }, name: string, availableSessionIds: string[] = []) {
  const email = `${name.toLowerCase()}-${++counter}@example.test`
  const participant = await prisma.participant.create({
    data: { name, slug: `${name.toLowerCase()}-${counter}`, email, gameLinks: { create: { gameId: game.id } } }
  })
  return await prisma.registration.create({
    data: {
      periodId: period.id,
      participantId: participant.id,
      status: 'received',
      source: 'form',
      email,
      tokenHash: `hash-${counter}`,
      availabilities: { create: availableSessionIds.map((sessionId) => ({ sessionId })) }
    }
  })
}

type Received = Awaited<ReturnType<typeof received>>
// Plusieurs inscriptions reçues, dans l'ordre des noms
async function receivedAll(game: { id: string }, period: { id: string }, names: string[], availableSessionIds: string[] = []) {
  const all: Received[] = []
  for (const name of names) all.push(await received(game, period, name, availableSessionIds))
  return all as [Received, Received, Received]
}

const message = (response: { body: unknown }) => (response.body as { message?: string }).message ?? ''
const body = (response: { body: unknown }) => response.body as any

const select = (registrationId: string, action: string, sessionId?: string) =>
  api(alice, 'POST', `/api/registrations/${registrationId}/selection`, { action, sessionId })

const statusOf = async (id: string) => (await prisma.registration.findUniqueOrThrow({ where: { id } })).status

describe('trier les inscriptions (US-087)', () => {
  it('retient pour une session où la personne est disponible, sans dépasser les places', async () => {
    const { game, sessions, period } = await aliceGame({ seats: 1 })
    const lou = await received(game, period, 'Lou', [sessions[0]!.id])
    const max = await received(game, period, 'Max', [sessions[0]!.id, sessions[1]!.id])

    // Pas disponible pour la session 2
    expect((await select(lou.id, 'retain', sessions[1]!.id)).status).toBe(400)
    expect((await select(lou.id, 'retain', sessions[0]!.id)).status).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: lou.id } })).toMatchObject({ status: 'retained', sessionId: sessions[0]!.id, responseDueAt: null })

    // Session 1 complète : refus, la personne reste à trier
    const full = await select(max.id, 'retain', sessions[0]!.id)
    expect(full.status).toBe(409)
    expect(message(full)).toContain('complète')
    expect(await statusOf(max.id)).toBe('received')

    // On ne baisse pas les places sous le nombre de retenues
    const lowered = await api(alice, 'PUT', `/api/registration-periods/${period.id}`, {
      name: period.name, gameId: game.id, sessions: [{ sessionId: sessions[0]!.id, seats: 0 }, { sessionId: sessions[1]!.id, seats: 1 }]
    })
    expect(lowered.status).toBe(409)

    // Session inconnue de la période : refus
    const other = await aliceGame()
    expect((await select(max.id, 'retain', other.sessions[0]!.id)).status).toBe(400)
  })

  it('met en liste d’attente de plusieurs sessions, réordonne, et retenir vide les files', async () => {
    const { game, sessions, period } = await aliceGame({ seats: 1 })
    const both = sessions.map((session) => session.id)
    const [lou, max, zoe] = await receivedAll(game, period, ['Lou', 'Max', 'Zoé'], both)

    for (const registration of [lou, max]) {
      expect((await select(registration.id, 'waitlist', sessions[0]!.id)).status).toBe(200)
    }
    expect((await select(lou.id, 'waitlist', sessions[1]!.id)).status).toBe(200)
    expect(await statusOf(lou.id)).toBe('waitlisted')
    const entries = await prisma.registrationWaitlistEntry.findMany({ where: { sessionId: sessions[0]!.id }, orderBy: { position: 'asc' } })
    expect(entries.map((entry) => entry.registrationId)).toEqual([lou.id, max.id])

    // Réordonner : exactement les personnes de la file
    expect((await api(alice, 'PUT', `/api/registration-periods/${period.id}/waitlist`, { sessionId: sessions[0]!.id, registrationIds: [max.id] })).status).toBe(409)
    expect((await api(alice, 'PUT', `/api/registration-periods/${period.id}/waitlist`, { sessionId: sessions[0]!.id, registrationIds: [max.id, lou.id] })).status).toBe(200)
    const reordered = await prisma.registrationWaitlistEntry.findMany({ where: { sessionId: sessions[0]!.id }, orderBy: { position: 'asc' } })
    expect(reordered.map((entry) => entry.registrationId)).toEqual([max.id, lou.id])

    // Retenue dans la session 2, elle sort de toutes les files
    expect((await select(lou.id, 'retain', sessions[1]!.id)).status).toBe(200)
    expect(await prisma.registrationWaitlistEntry.count({ where: { registrationId: lou.id } })).toBe(0)

    // Sortie de sa dernière file, une personne est de nouveau à trier
    expect((await select(max.id, 'unwaitlist', sessions[0]!.id)).status).toBe(200)
    expect(await statusOf(max.id)).toBe('received')

    // Non retenue, puis remise à trier
    expect((await select(zoe.id, 'reject')).status).toBe(200)
    expect(await statusOf(zoe.id)).toBe('rejected')
    expect((await select(zoe.id, 'reset')).status).toBe(200)
    expect(await statusOf(zoe.id)).toBe('received')
  })

  it('signale les personnes qui ont déjà joué une session terminée du jeu (R7)', async () => {
    const { game, sessions, period } = await aliceGame({ replayPolicy: 'flagged' })
    const lou = await received(game, period, 'Lou', [sessions[0]!.id])
    const past = await prisma.session.create({ data: { name: 'Passée', slug: `passee-${++counter}`, gameId: game.id, status: 'completed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: past.id, participantId: lou.participantId, role: 'participant' } })

    const overview = await api(alice, 'GET', `/api/registration-periods/${period.id}/selection`)
    expect(overview.status).toBe(200)
    expect(body(overview).replayerParticipantIds).toEqual([lou.participantId])
    expect(body(overview).sessions.map((session: { id: string }) => session.id)).toEqual(sessions.map((session) => session.id))
  })

  it('refuse une décision sur une période en mode invitation, ou sur une inscription confirmée', async () => {
    const { game, sessions, period } = await aliceGame()
    const lou = await received(game, period, 'Lou', [sessions[0]!.id])
    await prisma.registration.update({ where: { id: lou.id }, data: { status: 'confirmed', sessionId: sessions[0]!.id } })
    expect((await select(lou.id, 'reject')).status).toBe(409)

    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { entryMode: 'invitation' } })
    const max = await received(game, period, 'Max', [sessions[0]!.id])
    expect((await select(max.id, 'reject')).status).toBe(409)
  })
})

describe('annoncer les résultats (US-088) et confirmer sa place (US-089)', () => {
  it('annonce chaque décision une fois, avec un nouveau lien ; la personne retenue confirme et rejoint la session', async () => {
    const { game, sessions, period } = await aliceGame({ sessions: 1, seats: 1 })
    const [lou, max, zoe] = await receivedAll(game, period, ['Lou', 'Max', 'Zoe'])
    await select(lou.id, 'retain', sessions[0]!.id)
    await select(max.id, 'waitlist', sessions[0]!.id)
    await select(zoe.id, 'reject')

    // Avant l'annonce, la personne retenue ne voit rien changer, et ne peut pas confirmer
    expect((await api(alice, 'POST', `/api/registration-periods/${period.id}/announce`)).status).toBe(200)
    const sent = smtp.received.filter((email) => [lou, max, zoe].some((registration) => email.to.includes(registration.email)))
    expect(sent).toHaveLength(3)
    const louEmail = sent.find((email) => email.to.includes(lou.email))!
    expect(louEmail.text).toContain('est retenue pour la session')
    expect(sent.find((email) => email.to.includes(max.email))!.text).toContain('liste d’attente')
    expect(sent.find((email) => email.to.includes(zoe.email))!.text).toContain('n’a pas été retenue')

    // Nouveau lien : l'ancien jeton est remplacé ; l'échéance part de l'annonce
    const announced = await prisma.registration.findUniqueOrThrow({ where: { id: lou.id } })
    expect(announced.tokenHash).not.toBe(lou.tokenHash)
    expect(announced).toMatchObject({ announcedStatus: 'retained', announcedSessionId: sessions[0]!.id })
    expect(announced.responseDueAt!.getTime()).toBeGreaterThan(Date.now() + 6 * DAY)

    // Une seconde annonce n'envoie rien
    const again = await api(alice, 'POST', `/api/registration-periods/${period.id}/announce`)
    expect(body(again).announcedCount).toBe(0)

    const token = personalLinkToken(louEmail)!
    const view = await publicApi('GET', `/api/public/registrations/${token}`)
    expect(view.body).toMatchObject({ status: 'retained', canConfirmPlace: true })
    const confirmed = await publicApi('POST', `/api/public/registrations/${token}/accept`)
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.status).toBe('confirmed')
    expect(await prisma.sessionParticipant.count({ where: { sessionId: sessions[0]!.id, participantId: lou.participantId, role: 'participant' } })).toBe(1)
    expect((await publicApi('POST', `/api/public/registrations/${token}/accept`)).status).toBe(409)
  })

  it('une décision pas encore annoncée ne se voit pas, et ne se confirme pas', async () => {
    const { game, sessions, period } = await aliceGame({ sessions: 1 })
    const lou = await received(game, period, 'Lou')
    await select(lou.id, 'waitlist', sessions[0]!.id)
    await api(alice, 'POST', `/api/registration-periods/${period.id}/announce`)
    const token = personalLinkToken(smtp.received.filter((email) => email.to.includes(lou.email)).at(-1)!)!

    // Retenue après l'annonce : la personne voit toujours la liste d'attente
    await select(lou.id, 'retain', sessions[0]!.id)
    const view = await publicApi('GET', `/api/public/registrations/${token}`)
    expect(view.body).toMatchObject({ status: 'waitlisted', canConfirmPlace: false })
    expect((await publicApi('POST', `/api/public/registrations/${token}/accept`)).status).toBe(409)
  })

  it('un échec d’envoi laisse la décision à annoncer, et l’ancien lien valable', async () => {
    const { game, sessions, period } = await aliceGame({ sessions: 1 })
    const lou = await received(game, period, 'Lou')
    await prisma.registration.update({ where: { id: lou.id }, data: { email: `refuse-${lou.email}` } })
    await select(lou.id, 'retain', sessions[0]!.id)
    const result = await api(alice, 'POST', `/api/registration-periods/${period.id}/announce`)
    expect(body(result).failures).toHaveLength(1)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: lou.id } })).toMatchObject({ announcedStatus: null, tokenHash: lou.tokenHash })
  })

  it('délai dépassé : l’équipe prolonge ou libère, puis retient la suivante de la file', async () => {
    const { game, sessions, period } = await aliceGame({ sessions: 1, seats: 1 })
    const [lou, max] = await receivedAll(game, period, ['Lou', 'Max'])
    await select(lou.id, 'retain', sessions[0]!.id)
    await select(max.id, 'waitlist', sessions[0]!.id)
    await api(alice, 'POST', `/api/registration-periods/${period.id}/announce`)
    await prisma.registration.update({ where: { id: lou.id }, data: { responseDueAt: new Date(Date.now() - DAY) } })

    const extended = await api(alice, 'POST', `/api/registrations/${lou.id}/extend`, { responseDueAt: new Date(Date.now() + 3 * DAY).toISOString() })
    expect(extended.status).toBe(200)
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/remind`)).status).toBe(200)
    expect(smtp.received.at(-1)!.text).toContain('Place retenue')

    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/release`)).status).toBe(200)
    expect(await statusOf(lou.id)).toBe('withdrawn')
    // La place est libre : la première de la file se retient, et reste à annoncer
    expect((await select(max.id, 'retain', sessions[0]!.id)).status).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: max.id } })).toMatchObject({ status: 'retained', announcedStatus: 'waitlisted' })
  })

  it('une personne retenue peut se désister ; une décision non annoncée ne se relance pas', async () => {
    const { game, sessions, period } = await aliceGame({ sessions: 1 })
    const lou = await received(game, period, 'Lou')
    await select(lou.id, 'retain', sessions[0]!.id)
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/remind`)).status).toBe(409)
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/withdraw`)).status).toBe(200)
    expect(await statusOf(lou.id)).toBe('withdrawn')
  })
})

describe('vivier de l’inscription permanente (US-090)', () => {
  it('retient dans le vivier pour une session sans période dédiée, avec ses places', async () => {
    const { game, sessions, period } = await aliceGame({ permanent: true })
    const [lou, max] = await receivedAll(game, period, ['Lou', 'Max'])

    const overview = await api(alice, 'GET', `/api/registration-periods/${period.id}/selection`)
    expect(body(overview).permanent).toBe(true)
    expect(body(overview).sessions.map((session: { id: string }) => session.id).sort()).toEqual(sessions.map((session) => session.id).sort())

    expect((await api(alice, 'PUT', `/api/registration-periods/${period.id}/pool-seats`, { sessionId: sessions[0]!.id, seats: 1 })).status).toBe(200)
    expect((await select(lou.id, 'retain', sessions[0]!.id)).status).toBe(200)
    expect((await select(max.id, 'retain', sessions[0]!.id)).status).toBe(409)
    // Dans le vivier, on ne marque personne « non retenue »
    expect((await select(max.id, 'reject')).status).toBe(400)
    // Places sous le nombre de retenues : refus
    expect((await api(alice, 'PUT', `/api/registration-periods/${period.id}/pool-seats`, { sessionId: sessions[0]!.id, seats: 0 })).status).toBe(409)

    // R31 : la session ne peut plus rejoindre une période dédiée
    const dedicated = await api(alice, 'POST', '/api/registration-periods', {
      name: 'Dédiée', gameId: game.id, entryMode: 'form', sessions: [{ sessionId: sessions[0]!.id, seats: 3 }]
    })
    expect(dedicated.status).toBe(409)
    expect(message(dedicated)).toContain('inscription permanente')
  })

  it('après une session terminée, la personne revient au vivier, sauf rejoueurs exclus', async () => {
    const { game, sessions, period } = await aliceGame({ permanent: true, replayPolicy: 'excluded' })
    const lou = await received(game, period, 'Lou')
    await prisma.registration.update({ where: { id: lou.id }, data: { status: 'confirmed', sessionId: sessions[0]!.id } })
    await prisma.sessionParticipant.create({ data: { sessionId: sessions[0]!.id, participantId: lou.participantId, role: 'participant' } })

    // Session à venir : la personne y joue, elle n'est pas dans le vivier
    expect((await select(lou.id, 'retain', sessions[1]!.id)).status).toBe(409)

    await prisma.session.update({ where: { id: sessions[0]!.id }, data: { status: 'completed' } })
    const excluded = await select(lou.id, 'retain', sessions[1]!.id)
    expect(excluded.status).toBe(409)
    expect(message(excluded)).toContain('déjà joué')

    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { replayPolicy: 'flagged' } })
    // Le jeu n'a pas de personnage PJ : sans places réglées, la session n'en a aucune (R5)
    expect((await select(lou.id, 'retain', sessions[1]!.id)).status).toBe(409)
    await prisma.session.update({ where: { id: sessions[1]!.id }, data: { poolSeats: 2 } })
    expect((await select(lou.id, 'retain', sessions[1]!.id)).status).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: lou.id } })).toMatchObject({ status: 'retained', sessionId: sessions[1]!.id })
    // Sa participation passée reste
    expect(await prisma.sessionParticipant.count({ where: { sessionId: sessions[0]!.id, participantId: lou.participantId } })).toBe(1)
  })
})
