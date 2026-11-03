// EPIC-022 : attribut et question d'équilibre (US-091), mode de sélection (US-092), tirage (US-093), journal (US-094)
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf } from './api'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let counter = 0
const DAY = 24 * 60 * 60 * 1000

afterAll(async () => {
  await prisma.$disconnect()
})


// Un jeu d'Alice, ses sessions, et une période ordinaire en mode formulaire
async function aliceGame(options: { sessions?: number, seats?: number, selectionMode?: string, organizerPicks?: number, waitlistSize?: number, weightBalance?: boolean, replayPolicy?: string } = {}) {
  const key = `tirage-${++counter}`
  const game = await prisma.game.create({
    data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, balanceAttribute: 'Genre du personnage', balanceValues: ['F', 'H'] }
  })
  const sessions = await Promise.all(Array.from({ length: options.sessions ?? 1 }, (_, index) => prisma.session.create({
    data: { name: `Session ${index + 1} ${key}`, slug: `session-${index + 1}-${key}`, gameId: game.id, date: new Date(Date.now() + (10 + index) * DAY) }
  })))
  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: game.id,
      name: `Période ${key}`,
      publicId: key,
      entryMode: 'form',
      state: 'open',
      selectionMode: options.selectionMode ?? 'random',
      organizerPicks: options.organizerPicks ?? null,
      waitlistSize: options.waitlistSize ?? 5,
      weightBalance: options.weightBalance ?? false,
      replayPolicy: options.replayPolicy ?? 'allowed',
      sessions: { create: sessions.map((session) => ({ sessionId: session.id, seats: options.seats ?? 2 })) }
    }
  })
  return { key, game, sessions, period }
}

async function received(game: { id: string }, period: { id: string }, name: string, extra: { availableSessionIds?: string[], balancePreference?: string | null } = {}) {
  const email = `tirage-${name.toLowerCase()}-${++counter}@example.test`
  const participant = await prisma.participant.create({
    data: { name, slug: `tirage-${name.toLowerCase()}-${counter}`, email, gameLinks: { create: { gameId: game.id } } }
  })
  return await prisma.registration.create({
    data: {
      periodId: period.id,
      participantId: participant.id,
      status: 'received',
      source: 'form',
      email,
      balancePreference: extra.balancePreference ?? null,
      availabilities: { create: (extra.availableSessionIds ?? []).map((sessionId) => ({ sessionId })) }
    }
  })
}

const statusOf = async (id: string) => (await prisma.registration.findUniqueOrThrow({ where: { id } })).status

describe('attribut et question d’équilibre (US-091)', () => {
  it('la valeur d’un PJ doit être une valeur du jeu', async () => {
    const { game } = await aliceGame()
    const created = await api(alice, 'POST', '/api/characters', { name: 'Ada', gameId: game.id, balanceValue: 'X' })
    expect(created.status).toBe(400)
    const ok = await api(alice, 'POST', '/api/characters', { name: 'Ada', gameId: game.id, balanceValue: 'F' })
    expect(ok.status).toBe(200)
    expect(bodyOf<ApiResponse<'/api/characters', 'post'>>(ok).balanceValue).toBe('F')
  })

  it('la question d’équilibre prend le nom et les valeurs de l’attribut du jeu, et refuse une autre valeur', async () => {
    const { game, period } = await aliceGame()
    const form = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
      standardFields: Object.fromEntries(['lastName', 'firstName', 'facebookName', 'phone', 'emergencyContact', 'dietary'].map((key) => [key, { asked: false, required: false }])),
      balance: { asked: true, required: true }
    })
    expect(form.status).toBe(200)
    expect(bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(form).definition.balance).toEqual({ asked: true, required: true, label: 'Genre du personnage', values: ['F', 'H'] })

    const view = await fetch(`${inject('baseUrl')}/api/public/periods/${period.publicId}`, { headers: { 'x-forwarded-for': `10.40.0.${++counter % 250}` } })
    expect((await view.json()).definition.balance.values).toEqual(['F', 'H'])

    const submit = (balancePreference: unknown) => fetch(`${inject('baseUrl')}/api/public/periods/${period.publicId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.40.1.${++counter % 250}` },
      body: JSON.stringify({ email: `eq-${counter}@example.test`, charterAccepted: true, balancePreference })
    })
    expect((await submit('X')).status).toBe(400)
    expect((await submit(undefined)).status).toBe(400)
    expect((await submit('*')).status).toBe(200)
    expect((await submit('F')).status).toBe(200)
    const requests = await prisma.registrationRequest.findMany({ where: { periodId: period.id }, select: { answers: true } })
    expect(requests.map((request) => (request.answers as { balancePreference: string | null }).balancePreference).sort()).toEqual(['F', null])
  })
})

describe('mode de sélection (US-092)', () => {
  it('en mode hasard, on ne retient pas à la main avant le tirage ; après, si', async () => {
    const { game, sessions, period } = await aliceGame({ seats: 1 })
    const [lou, max] = [await received(game, period, 'Lou'), await received(game, period, 'Max')]
    const refused = await api(alice, 'POST', `/api/registrations/${lou.id}/selection`, { action: 'retain', sessionId: sessions[0]!.id })
    expect(refused.status).toBe(409)
    expect((await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)).status).toBe(200)
    // Correction après le tirage : remettre la personne tirée à trier, retenir l'autre
    const drawn = (await prisma.registration.findFirstOrThrow({ where: { id: { in: [lou.id, max.id] }, status: 'retained' } })).id
    const other = drawn === lou.id ? max.id : lou.id
    expect((await api(alice, 'POST', `/api/registrations/${drawn}/selection`, { action: 'reset' })).status).toBe(200)
    expect((await api(alice, 'POST', `/api/registrations/${other}/selection`, { action: 'retain', sessionId: sessions[0]!.id })).status).toBe(200)
  })

  it('en mode mixte, chaque organisatrice retient au plus N personnes par session avant le tirage', async () => {
    const { game, sessions, period } = await aliceGame({ selectionMode: 'mixed', organizerPicks: 1, seats: 3 })
    const [lou, max, zoe] = [await received(game, period, 'Lou'), await received(game, period, 'Max'), await received(game, period, 'Zoe')]
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/selection`, { action: 'retain', sessionId: sessions[0]!.id })).status).toBe(200)
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: lou.id } })).toMatchObject({ retainedById: alice.id })
    expect((await api(alice, 'POST', `/api/registrations/${max.id}/selection`, { action: 'retain', sessionId: sessions[0]!.id })).status).toBe(409)

    // Le tirage remplit les places restantes, sans toucher au choix d'Alice
    expect((await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)).status).toBe(200)
    expect(await statusOf(lou.id)).toBe('retained')
    expect([await statusOf(max.id), await statusOf(zoe.id)]).toEqual(['retained', 'retained'])
  })

  it('le tirage ne concerne pas une période sélectionnée à la main, ni l’inscription permanente', async () => {
    const { period } = await aliceGame({ selectionMode: 'chosen' })
    expect((await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)).status).toBe(409)
    const { game } = await aliceGame()
    const permanent = await api(alice, 'POST', '/api/registration-periods', { name: 'Toujours', gameId: game.id, entryMode: 'form', scope: 'game', selectionMode: 'random' })
    expect(permanent.status).toBe(400)
  })
})

describe('tirer au sort (US-093) et journal (US-094)', () => {
  it('tire session par session, met en attente dans la limite réglée, et écarte le reste', async () => {
    const { game, sessions, period } = await aliceGame({ sessions: 2, seats: 1, waitlistSize: 1 })
    const both = sessions.map((session) => session.id)
    const registrations = []
    for (const name of ['Lou', 'Max', 'Zoe', 'Noa', 'Eli']) registrations.push(await received(game, period, name, { availableSessionIds: both }))

    const drawn = await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)
    expect(drawn.status).toBe(200)
    const rows = await prisma.registration.findMany({ where: { periodId: period.id }, include: { waitlistEntries: true } })
    const retained = rows.filter((row) => row.status === 'retained')
    expect(retained.map((row) => row.sessionId).sort()).toEqual([...both].sort())
    expect(retained.every((row) => row.retainedById === null && row.announcedStatus === null)).toBe(true)
    // Une personne en attente par session au plus
    for (const session of sessions) {
      expect(await prisma.registrationWaitlistEntry.count({ where: { sessionId: session.id } })).toBeLessThanOrEqual(1)
    }
    expect(rows.filter((row) => row.status === 'rejected').length).toBeGreaterThanOrEqual(1)

    // Journal : graine, réglages et résultat ; un seul tirage actif
    const journal = await api(alice, 'GET', `/api/registration-periods/${period.id}/draws`)
    expect(journal.body).toHaveLength(1)
    const [draw] = bodyOf<ApiResponse<'/api/registration-periods/:id/draws'>>(journal)
    expect(draw).toMatchObject({ cancelledAt: null, createdBy: { name: expect.any(String) } })
    expect(draw?.seed).toMatch(/^[0-9a-f]{32}$/)
    expect((await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)).status).toBe(409)

    // Annuler : tout repart à trier, et on peut refaire
    expect((await api(alice, 'POST', `/api/registration-draws/${draw!.id}/cancel`)).status).toBe(200)
    expect((await prisma.registration.findMany({ where: { periodId: period.id } })).every((row) => row.status === 'received')).toBe(true)
    expect(await prisma.registrationWaitlistEntry.count({ where: { sessionId: { in: both } } })).toBe(0)
    expect((await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)).status).toBe(200)
  })

  it('n’annule plus un tirage dont un résultat est annoncé', async () => {
    const { game, period } = await aliceGame()
    const lou = await received(game, period, 'Lou')
    await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)
    await prisma.registration.update({ where: { id: lou.id }, data: { announcedStatus: 'retained', announcedAt: new Date(Date.now() + 1000) } })
    const draw = await prisma.registrationDraw.findFirstOrThrow({ where: { periodId: period.id } })
    expect((await api(alice, 'POST', `/api/registration-draws/${draw.id}/cancel`)).status).toBe(409)
  })

  it('ne tire pas les rejoueurs exclus', async () => {
    const { game, period } = await aliceGame({ replayPolicy: 'excluded' })
    const lou = await received(game, period, 'Lou')
    const past = await prisma.session.create({ data: { name: 'Passée', slug: `tirage-passee-${++counter}`, gameId: game.id, status: 'completed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: past.id, participantId: lou.participantId, role: 'participant' } })
    await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)
    expect(await statusOf(lou.id)).toBe('received')
  })

  it('« non tirés avant » ne regarde que les périodes précédentes, et le journal garde les entrées du calcul', async () => {
    const { game, period } = await aliceGame()
    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { weightNotDrawnBefore: true } })
    const lou = await received(game, period, 'Lou')
    const max = await received(game, period, 'Max')
    const before = await prisma.registrationPeriod.create({ data: { gameId: game.id, name: 'Avant', publicId: `avant-${++counter}`, entryMode: 'form', createdAt: new Date(Date.now() - DAY) } })
    const after = await prisma.registrationPeriod.create({ data: { gameId: game.id, name: 'Après', publicId: `apres-${++counter}`, entryMode: 'form', createdAt: new Date(Date.now() + DAY) } })
    await prisma.registration.create({ data: { periodId: before.id, participantId: lou.participantId, status: 'rejected', source: 'form', email: lou.email } })
    await prisma.registration.create({ data: { periodId: after.id, participantId: max.participantId, status: 'rejected', source: 'form', email: max.email } })
    await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)
    const draw = await prisma.registrationDraw.findFirstOrThrow({ where: { periodId: period.id } })
    const candidates = (draw.settings as { sessions: Array<{ candidates: Array<{ registrationId: string, weight: number }> }> }).sessions[0]!.candidates
    expect(Object.fromEntries(candidates.map((candidate) => [candidate.registrationId, candidate.weight]))).toEqual({ [lou.id]: 2, [max.id]: 1 })
  })

  it('une valeur retirée du jeu est retirée de ses personnages', async () => {
    const { game } = await aliceGame()
    const ada = await prisma.character.create({ data: { name: 'Ada', slug: `tirage-ada-${++counter}`, gameId: game.id, type: 'pj', balanceValue: 'F' } })
    expect((await api(alice, 'PUT', `/api/games/${game.id}`, { balanceAttribute: 'Genre du personnage', balanceValues: ['Femme', 'Homme'] })).status).toBe(200)
    expect((await prisma.character.findUniqueOrThrow({ where: { id: ada.id } })).balanceValue).toBeNull()
  })

  it('équilibre : les places suivent les valeurs des PJ', async () => {
    const { game, period } = await aliceGame({ seats: 2, weightBalance: true, waitlistSize: 0 })
    await prisma.character.createMany({ data: [
      { name: 'Ada', slug: `tirage-ada-${++counter}`, gameId: game.id, type: 'pj', balanceValue: 'F' },
      { name: 'Bob', slug: `tirage-bob-${++counter}`, gameId: game.id, type: 'pj', balanceValue: 'H' }
    ] })
    const women = [await received(game, period, 'Lou', { balancePreference: 'F' }), await received(game, period, 'Zoe', { balancePreference: 'F' })]
    const man = await received(game, period, 'Max', { balancePreference: 'H' })
    await api(alice, 'POST', `/api/registration-periods/${period.id}/draws`)
    expect(await statusOf(man.id)).toBe('retained')
    expect((await Promise.all(women.map((registration) => statusOf(registration.id)))).sort()).toEqual(['rejected', 'retained'])
  })
})
