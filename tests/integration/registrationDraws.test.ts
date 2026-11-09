// EPIC-022 et US-171 : équilibre (US-091), mode de sélection (US-092), tirage d'une session (R22, R23), journal (US-094)
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { computeDraw } from '~/utils/registrationDraw'
import { api, bodyOf } from './api'
import { createTestPrisma } from './db'
import { addPerson, createPool, lineOf } from './pool'
import type { SelectionMode } from '~/generated/prisma/enums'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

const sessionPool = (options: Parameters<typeof createPool>[2] & { selectionMode?: SelectionMode, organizerPicks?: number, waitlistSize?: number, weightBalance?: boolean, weightNotDrawnBefore?: boolean } = {}) => {
  const { selectionMode, organizerPicks, waitlistSize, weightBalance, weightNotDrawnBefore, ...rest } = options
  return createPool(prisma, alice.id, {
    key: 'tirage',
    sessions: 1,
    seats: 2,
    game: { balanceAttribute: 'Genre du personnage', balanceValues: ['F', 'H'] },
    ...rest,
    selection: { selectionMode: selectionMode ?? 'random', organizerPicks, waitlistSize: waitlistSize ?? 5, weightBalance: weightBalance ?? false, weightNotDrawnBefore: weightNotDrawnBefore ?? false }
  })
}
const draw = (periodId: string, sessionId: string) => api(alice, 'POST', `/api/registration-periods/${periodId}/draws`, { sessionId })
const statusOf = async (registrationId: string, sessionId: string) => (await lineOf(prisma, registrationId, sessionId))?.status

describe('attribut et question d’équilibre (US-091)', () => {
  it('la valeur d’un PJ doit être une valeur du jeu', async () => {
    const { game } = await sessionPool()
    const created = await api(alice, 'POST', '/api/characters', { name: 'Ada', gameId: game.id, balanceValue: 'X' })
    expect(created.status).toBe(400)
    const ok = await api(alice, 'POST', '/api/characters', { name: 'Ada', gameId: game.id, balanceValue: 'F' })
    expect(ok.status).toBe(200)
    expect(bodyOf<ApiResponse<'/api/characters', 'post'>>(ok).balanceValue).toBe('F')
  })

  it('la question d’équilibre prend le nom et les valeurs de l’attribut du jeu, et refuse une autre valeur', async () => {
    const { game, period } = await sessionPool()
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
      body: JSON.stringify({ email: `eq-${counter}@example.test`, emergencyContactName: 'Paul Secours', emergencyContactPhone: '0699999999', charterAccepted: true, balancePreference })
    })
    expect((await submit('X')).status).toBe(400)
    expect((await submit(undefined)).status).toBe(400)
    expect((await submit('*')).status).toBe(200)
    expect((await submit('F')).status).toBe(200)
    const requests = await prisma.registrationRequest.findMany({ where: { periodId: period.id }, select: { answers: true } })
    expect(requests.map((request) => (request.answers as { balancePreference: string | null }).balancePreference).sort()).toEqual(['F', null])
  })
})

describe('mode de sélection de la session (R22)', () => {
  it('en mode hasard, on ne retient pas à la main avant le tirage ; après, si', async () => {
    const pool = await sessionPool({ seats: 1 })
    const sessionId = pool.sessions[0]!.id
    const [lou, max] = [await addPerson(prisma, pool, 'Lou', [sessionId]), await addPerson(prisma, pool, 'Max', [sessionId])]
    const refused = await api(alice, 'POST', `/api/registrations/${lou.id}/selection`, { action: 'retain', sessionId })
    expect(refused.status).toBe(409)
    expect((await draw(pool.period.id, sessionId)).status).toBe(200)
    // Correction après le tirage : remettre la personne tirée à sa réponse, retenir l'autre
    const drawn = (await prisma.registrationSession.findFirstOrThrow({ where: { sessionId, status: 'retained' } })).registrationId
    const other = drawn === lou.id ? max.id : lou.id
    expect((await api(alice, 'POST', `/api/registrations/${drawn}/selection`, { action: 'reset', sessionId })).status).toBe(200)
    expect(await statusOf(drawn, sessionId)).toBe('preregistered')
    expect((await api(alice, 'POST', `/api/registrations/${other}/selection`, { action: 'retain', sessionId })).status).toBe(200)
  })

  it('en mode mixte, chaque organisatrice retient au plus N personnes avant le tirage', async () => {
    const pool = await sessionPool({ selectionMode: 'mixed', organizerPicks: 1, seats: 3 })
    const sessionId = pool.sessions[0]!.id
    const [lou, max, zoe] = [await addPerson(prisma, pool, 'Lou', [sessionId]), await addPerson(prisma, pool, 'Max', [sessionId]), await addPerson(prisma, pool, 'Zoe', [sessionId])]
    expect((await api(alice, 'POST', `/api/registrations/${lou.id}/selection`, { action: 'retain', sessionId })).status).toBe(200)
    expect(await lineOf(prisma, lou.id, sessionId)).toMatchObject({ retainedById: alice.id })
    expect((await api(alice, 'POST', `/api/registrations/${max.id}/selection`, { action: 'retain', sessionId })).status).toBe(409)

    // Le tirage remplit les places restantes, sans toucher au choix d'Alice
    expect((await draw(pool.period.id, sessionId)).status).toBe(200)
    expect(await statusOf(lou.id, sessionId)).toBe('retained')
    expect([await statusOf(max.id, sessionId), await statusOf(zoe.id, sessionId)]).toEqual(['retained', 'retained'])
  })

  it('le tirage ne concerne pas une session à la main, ni une session d’un autre jeu', async () => {
    const pool = await sessionPool({ selectionMode: 'chosen' })
    expect((await draw(pool.period.id, pool.sessions[0]!.id)).status).toBe(409)
    const other = await sessionPool()
    expect((await draw(pool.period.id, other.sessions[0]!.id)).status).toBe(400)
  })
})

describe('tirer au sort une session (R22, R23) et journal (US-094)', () => {
  it('porte sur ses pré-inscrits ; les personnes au-delà de la liste d’attente restent pré-inscrites, sans message', async () => {
    const pool = await sessionPool({ sessions: 2, seats: 1, waitlistSize: 1 })
    const [first, second] = pool.sessions.map((session) => session.id) as [string, string]
    const registrations = []
    for (const name of ['Lou', 'Max', 'Zoe', 'Noa']) registrations.push(await addPerson(prisma, pool, name, [first, second]))
    // Sans réponse pour cette session : hors du tirage
    const outside = await addPerson(prisma, pool, 'Eli', [second])

    const drawn = await draw(pool.period.id, first)
    expect(drawn.status, JSON.stringify(drawn.body)).toBe(200)
    const lines = await prisma.registrationSession.findMany({ where: { sessionId: first } })
    expect(lines).toHaveLength(4)
    const count = (status: string) => lines.filter((line) => line.status === status).length
    expect([count('retained'), count('waitlisted'), count('preregistered')]).toEqual([1, 1, 2])
    expect(lines.find((line) => line.status === 'retained')).toMatchObject({ retainedById: null, announcedStatus: null })
    expect(lines.find((line) => line.status === 'waitlisted')).toMatchObject({ waitlistPosition: 1 })
    expect(await statusOf(outside.id, first)).toBeUndefined()

    // L'autre session n'est pas touchée, et a son propre tirage
    expect(await prisma.registrationSession.count({ where: { sessionId: second, status: 'preregistered' } })).toBe(5)
    expect((await draw(pool.period.id, second)).status).toBe(200)

    // Journal : graine, session et résultat ; un seul tirage actif par session
    const journal = bodyOf<ApiResponse<'/api/registration-periods/:id/draws'>>(await api(alice, 'GET', `/api/registration-periods/${pool.period.id}/draws`))
    expect(journal).toHaveLength(2)
    const entry = journal.find((row) => row.sessionId === first)!
    expect(entry).toMatchObject({ cancelledAt: null, createdBy: { name: expect.any(String) } })
    expect(entry.seed).toMatch(/^[0-9a-f]{32}$/)
    expect((await draw(pool.period.id, first)).status).toBe(409)

    // Annuler : la session revient à son état d'avant, et on peut refaire
    expect((await api(alice, 'POST', `/api/registration-draws/${entry.id}/cancel`)).status).toBe(200)
    expect((await prisma.registrationSession.findMany({ where: { sessionId: first } })).every((line) => line.status === 'preregistered' && line.waitlistPosition === null)).toBe(true)
    expect((await draw(pool.period.id, first)).status).toBe(200)
  })

  it('la même graine et les mêmes entrées donnent le même résultat', async () => {
    const pool = await sessionPool({ seats: 2, waitlistSize: 1 })
    const sessionId = pool.sessions[0]!.id
    for (const name of ['Lou', 'Max', 'Zoe', 'Noa']) await addPerson(prisma, pool, name, [sessionId])
    await draw(pool.period.id, sessionId)
    const row = await prisma.registrationDraw.findFirstOrThrow({ where: { sessionId } })
    const { sessions } = row.settings as { sessions: Parameters<typeof computeDraw>[1] }
    expect(await computeDraw(row.seed, sessions, 1)).toEqual(row.result)
  })

  it('n’annule plus un tirage dont un résultat est annoncé, ni un ancien tirage sans session', async () => {
    const pool = await sessionPool()
    const sessionId = pool.sessions[0]!.id
    const lou = await addPerson(prisma, pool, 'Lou', [sessionId])
    await draw(pool.period.id, sessionId)
    await prisma.registrationSession.update({ where: { registrationId_sessionId: { registrationId: lou.id, sessionId } }, data: { announcedStatus: 'retained', announcedAt: new Date(Date.now() + 1000) } })
    const row = await prisma.registrationDraw.findFirstOrThrow({ where: { sessionId } })
    expect((await api(alice, 'POST', `/api/registration-draws/${row.id}/cancel`)).status).toBe(409)

    const old = await prisma.registrationDraw.create({ data: { gameId: pool.period.gameId, periodId: pool.period.id, seed: 'ancienne', settings: {}, result: { sessions: [], rejected: [] } } })
    expect((await api(alice, 'POST', `/api/registration-draws/${old.id}/cancel`)).status).toBe(409)
  })

  it('ne tire pas les rejoueurs exclus', async () => {
    const pool = await sessionPool({ replayPolicy: 'excluded' })
    const sessionId = pool.sessions[0]!.id
    const lou = await addPerson(prisma, pool, 'Lou', [sessionId])
    const past = await prisma.session.create({ data: { name: 'Passée', slug: `tirage-passee-${pool.key}`, gameId: pool.game.id, status: 'completed' } })
    await prisma.sessionParticipant.create({ data: { sessionId: past.id, participantId: lou.participantId, role: 'participant' } })
    await draw(pool.period.id, sessionId)
    expect(await statusOf(lou.id, sessionId)).toBe('preregistered')
  })

  it('« non tirés avant » vise une personne restée sans place à un tirage d’une session plus ancienne', async () => {
    const pool = await sessionPool({ sessions: 2, seats: 1, waitlistSize: 0, weightNotDrawnBefore: true })
    const [first, second] = pool.sessions.map((session) => session.id) as [string, string]
    const lou = await addPerson(prisma, pool, 'Lou', [first, second])
    const max = await addPerson(prisma, pool, 'Max', [first, second])

    await draw(pool.period.id, first)
    const firstResult = (await prisma.registrationDraw.findFirstOrThrow({ where: { sessionId: first } })).result as { sessions: Array<{ retained: string[] }>, rejected: string[] }
    const withoutSeat = firstResult.rejected[0]!
    const seated = firstResult.sessions[0]!.retained[0]!
    expect([lou.id, max.id].sort()).toEqual([withoutSeat, seated].sort())

    await draw(pool.period.id, second)
    const row = await prisma.registrationDraw.findFirstOrThrow({ where: { sessionId: second } })
    const candidates = (row.settings as { sessions: Array<{ candidates: Array<{ registrationId: string, weight: number }> }> }).sessions[0]!.candidates
    expect(Object.fromEntries(candidates.map((candidate) => [candidate.registrationId, candidate.weight]))).toEqual({ [withoutSeat]: 2, [seated]: 1 })
  })

  it('une valeur retirée du jeu est retirée de ses personnages', async () => {
    const { game, key } = await sessionPool()
    const ada = await prisma.character.create({ data: { name: 'Ada', slug: `tirage-ada-${key}`, gameId: game.id, type: 'pj', balanceValue: 'F' } })
    expect((await api(alice, 'PUT', `/api/games/${game.id}`, { balanceAttribute: 'Genre du personnage', balanceValues: ['Femme', 'Homme'] })).status).toBe(200)
    expect((await prisma.character.findUniqueOrThrow({ where: { id: ada.id } })).balanceValue).toBeNull()
  })

  it('équilibre : les places suivent les valeurs des PJ', async () => {
    const pool = await sessionPool({ seats: 0, weightBalance: true, waitlistSize: 0 })
    const sessionId = pool.sessions[0]!.id
    await prisma.character.createMany({ data: [
      { name: 'Ada', slug: `tirage-ada-${pool.key}`, gameId: pool.game.id, type: 'pj', balanceValue: 'F' },
      { name: 'Bob', slug: `tirage-bob-${pool.key}`, gameId: pool.game.id, type: 'pj', balanceValue: 'H' }
    ] })
    const women = [await addPerson(prisma, pool, 'Lou', [sessionId], { balancePreference: 'F' }), await addPerson(prisma, pool, 'Zoe', [sessionId], { balancePreference: 'F' })]
    const man = await addPerson(prisma, pool, 'Max', [sessionId], { balancePreference: 'H' })
    await draw(pool.period.id, sessionId)
    expect(await statusOf(man.id, sessionId)).toBe('retained')
    expect((await Promise.all(women.map((registration) => statusOf(registration.id, sessionId)))).sort()).toEqual(['preregistered', 'retained'])
  })
})
