// EPIC-023 : affinités rattachées (US-095), alertes et repères dans la sélection (US-096)
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


// Un jeu d'Alice, deux sessions et une période en mode formulaire
async function aliceGame() {
  const key = `affinites-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const sessions = await Promise.all([0, 1].map((index) => prisma.session.create({
    data: { name: `Session ${index + 1} ${key}`, slug: `session-${index + 1}-${key}`, gameId: game.id, date: new Date(Date.now() + (10 + index) * DAY) }
  })))
  await prisma.character.createMany({ data: [1, 2, 3].map((index) => ({ name: `PJ ${index}`, slug: `pj-${index}-${key}`, gameId: game.id, type: 'pj' })) })
  const period = await prisma.registrationPeriod.create({
    data: {
      gameId: game.id,
      publicId: key,
      state: 'open',
      sessions: { create: sessions.map((session) => ({ sessionId: session.id })) }
    }
  })
  return { game, sessions, period }
}

async function person(game: { id: string }, name: string) {
  return await prisma.participant.create({
    data: { name, slug: `affinites-personne-${++counter}`, gameLinks: { create: { gameId: game.id } } }
  })
}

type Line = [kind: string, text: string, targetParticipantId?: string]

async function registration(period: { id: string }, participant: { id: string }, extra: { status?: string, sessionId?: string, affinities?: Line[], availableSessionIds?: string[] } = {}) {
  return await prisma.registration.create({
    data: {
      periodId: period.id,
      participantId: participant.id,
      status: 'received',
      source: 'form',
      email: `affinites-${++counter}@example.test`,
      sessionLines: {
        create: [
          ...(extra.sessionId ? [{ sessionId: extra.sessionId, status: extra.status ?? 'retained' }] : []),
          ...(extra.availableSessionIds ?? []).map((sessionId) => ({ sessionId, status: 'preregistered', answer: 'available' }))
        ]
      },
      affinities: {
        create: (extra.affinities ?? []).map(([kind, text, targetParticipantId], position) => ({ kind, text, position, targetParticipantId: targetParticipantId ?? null }))
      }
    }
  })
}

const overviewOf = async (period: { id: string }) => bodyOf<ApiResponse<'/api/registration-periods/:id/selection'>>(await api(alice, 'GET', `/api/registration-periods/${period.id}/selection`))

describe('rattacher les affinités (US-095)', () => {
  it('propose des personnes du jeu au nom proche sans rien rattacher, puis rattache, marque inconnue et détache', async () => {
    const { game, period } = await aliceGame()
    const lou = await person(game, 'Lou')
    const paul = await person(game, 'Paul Durand')
    await person(game, 'Zacharie Lemoine')
    const own = await registration(period, lou, { affinities: [['avoid', 'Paul D.'], ['refusedRelations', 'Romance'], ['wantWith', 'Personne connue']] })

    const detail = bodyOf<ApiResponse<'/api/registrations/:id'>>(await api(alice, 'GET', `/api/registrations/${own.id}`))
    const [avoid, relation, unknown] = detail.affinityLines
    expect(avoid).toMatchObject({ linkable: true, target: null, suggestions: [{ id: paul.id, name: 'Paul Durand' }] })
    expect(relation).toMatchObject({ linkable: false, suggestions: [] })
    expect(unknown?.suggestions).toEqual([])
    // Rien n'est rattaché sans l'équipe, et la personne elle-même n'est pas proposée
    expect(await prisma.registrationAffinity.count({ where: { registrationId: own.id, targetParticipantId: { not: null } } })).toBe(0)
    expect(detail.gamePeople.map((entry) => entry.id)).not.toContain(lou.id)

    const linked = await api(alice, 'POST', `/api/registration-affinities/${avoid!.id}/link`, { targetParticipantId: paul.id })
    expect(linked.status).toBe(200)
    expect(bodyOf<ApiResponse<'/api/registration-affinities/:id/link', 'post'>>(linked).targetParticipant).toEqual({ id: paul.id, name: 'Paul Durand' })
    expect((await api(alice, 'POST', `/api/registration-affinities/${relation!.id}/link`, { unknown: true })).status).toBe(400)
    expect((await api(alice, 'POST', `/api/registration-affinities/${avoid!.id}/link`, { targetParticipantId: lou.id })).status).toBe(400)

    expect((await api(alice, 'POST', `/api/registration-affinities/${unknown!.id}/link`, { unknown: true })).body).toMatchObject({ targetUnknown: true, targetParticipant: null })
    expect((await overviewOf(period)).affinities.toLink).toEqual({})

    expect((await api(alice, 'POST', `/api/registration-affinities/${avoid!.id}/link`, {})).body).toMatchObject({ targetUnknown: false, targetParticipant: null })
    expect((await overviewOf(period)).affinities.toLink).toEqual({ [own.id]: 1 })
  })

  it('l’export contient les affinités écrites par la personne, avec la personne rattachée, pas celles qui la visent', async () => {
    const { game, period } = await aliceGame()
    const lou = await person(game, 'Lou')
    const max = await person(game, 'Max')
    await registration(period, lou, { affinities: [['avoid', 'Max le grand', max.id]] })
    await registration(period, max, { affinities: [['notWith', 'Lou la petite', lou.id]] })
    const exported = JSON.stringify((await api(alice, 'GET', `/api/participants/${lou.id}/export`)).body)
    expect(exported).toContain('Max le grand')
    expect(exported).toContain('"targetParticipant":{"name":"Max"}')
    expect(exported).not.toContain('Lou la petite')
  })

  it('effacer une personne supprime les lignes qui la visent', async () => {
    const { game, period } = await aliceGame()
    const lou = await person(game, 'Lou')
    const max = await person(game, 'Max')
    const own = await registration(period, lou, { affinities: [['avoid', 'Max', max.id], ['avoid', 'Autre']] })
    expect((await api(alice, 'DELETE', `/api/participants/${max.id}`)).status).toBe(200)
    expect(await prisma.registrationAffinity.findMany({ where: { registrationId: own.id }, select: { text: true } })).toEqual([{ text: 'Autre' }])
  })
})

describe('alertes et repères dans la sélection (US-096)', () => {
  it('alerte entre deux personnes de la même session, cast compris ; pas entre deux sessions', async () => {
    const { game, sessions, period } = await aliceGame()
    const [first, second] = sessions
    const lou = await person(game, 'Lou')
    const max = await person(game, 'Max')
    const pnj = await person(game, 'Pnj')
    const noe = await person(game, 'Noé')
    const louReg = await registration(period, lou, { status: 'retained', sessionId: first!.id, affinities: [['avoid', 'Max', max.id], ['notWith', 'Pnj', pnj.id], ['avoid', 'Noé', noe.id]] })
    await registration(period, max, { status: 'confirmed', sessionId: first!.id })
    await registration(period, noe, { status: 'retained', sessionId: second!.id })
    await prisma.sessionParticipant.create({ data: { sessionId: first!.id, participantId: pnj.id, role: 'pnj' } })

    const { alerts } = (await overviewOf(period)).affinities
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: first!.id, kind: 'avoid', registrationId: louReg.id, participantName: 'Lou', targetName: 'Max' }),
      expect.objectContaining({ sessionId: first!.id, kind: 'notWith', targetName: 'Pnj' })
    ]))
    expect(alerts).toHaveLength(2)
  })

  it('retenir une personne qui crée une alerte est accepté', async () => {
    const { game, sessions, period } = await aliceGame()
    const lou = await person(game, 'Lou')
    const max = await person(game, 'Max')
    await registration(period, lou, { status: 'retained', sessionId: sessions[0]!.id, affinities: [['avoid', 'Max', max.id]] })
    const maxReg = await registration(period, max, { availableSessionIds: [sessions[0]!.id] })
    expect((await api(alice, 'POST', `/api/registrations/${maxReg.id}/selection`, { action: 'retain', sessionId: sessions[0]!.id })).status).toBe(200)
    expect((await overviewOf(period)).affinities.alerts).toHaveLength(1)
  })

  it('donne les sessions où se trouvent les personnes souhaitées', async () => {
    const { game, sessions, period } = await aliceGame()
    const lou = await person(game, 'Lou')
    const max = await person(game, 'Max')
    const zoe = await person(game, 'Zoé')
    const louReg = await registration(period, lou, { affinities: [['wantWith', 'Max', max.id], ['wantWith', 'Zoé', zoe.id], ['wantWith', 'Inconnue']] })
    await registration(period, max, { status: 'retained', sessionId: sessions[1]!.id })
    const { wishes, toLink } = (await overviewOf(period)).affinities
    expect(wishes[louReg.id]).toEqual([
      { participantId: max.id, name: 'Max', sessionIds: [sessions[1]!.id] },
      { participantId: zoe.id, name: 'Zoé', sessionIds: [] }
    ])
    expect(toLink).toEqual({ [louReg.id]: 1 })
  })
})
