// EPIC-025 : cadenas et réservation (US-100), notes et interdits (US-101), proposition (US-102)
import { createHash, randomBytes } from 'node:crypto'
import { afterAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf } from './api'
import { createTestPrisma } from './db'
import type { AffinityKind } from '~/generated/prisma/enums'

const prisma = createTestPrisma()
const { alice, bob } = inject('world').users
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

type SavedSession = ApiResponse<'/api/sessions/:id', 'put'>
type CastingProposal = ApiResponse<'/api/sessions/:id/casting-assistant', 'post'>
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const off = { asked: false, required: false }
const standardFields = { lastName: off, firstName: off, facebookName: off, phone: off, emergencyContact: off, dietary: off }

async function publicApi(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'x-forwarded-for': `10.25.0.${counter}` }
  if (body) headers['content-type'] = 'application/json'
  const response = await fetch(`${inject('baseUrl')}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: response.status }
}

// Un jeu d'Alice : Iseult (faction Loups) et Bran en relation romance, Cy seul ; une session ; une question reliée
async function castingGame() {
  const key = `casting-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id } })
  const faction = await prisma.faction.create({ data: { name: 'Loups', slug: `${key}-loups`, gameId: game.id } })
  const [iseult, bran, cy] = await Promise.all(['Iseult', 'Bran', 'Cy'].map((name) => prisma.character.create({
    data: { name, slug: `${key}-${name.toLowerCase()}`, gameId: game.id, ...(name === 'Iseult' && { factions: { connect: { id: faction.id } } }) }
  })))
  await prisma.characterRelation.create({ data: { gameId: game.id, type: 'romance', fromCharacterId: iseult!.id, toCharacterId: bran!.id } })
  const form = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
    standardFields,
    affinities: { notWith: { asked: true, required: false }, refusedRelations: { asked: true, required: false } },
    questions: [{ label: 'Ton style', type: 'single', required: false, options: ['Intrigue', 'Combat'] }, { label: 'Ton expérience', type: 'scale', required: false, options: [] }]
  })
  expect(form.status, JSON.stringify(form.body)).toBe(200)
  const [style, level] = bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(form).definition.questions
  const links = await api(alice, 'PUT', `/api/games/${game.id}/registration-question-links`, {
    links: [
      { questionId: style!.id, option: 'Intrigue', characterId: iseult!.id },
      { questionId: level!.id, option: '', factionId: faction.id }
    ]
  })
  expect(links.status, JSON.stringify(links.body)).toBe(200)
  const session = await prisma.session.create({ data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id } })
  const period = await prisma.registrationPeriod.create({
    data: { gameId: game.id, publicId: `pub-${key}`, state: 'open', sessions: { create: { sessionId: session.id } } }
  })
  return { key, game, session, period, iseult: iseult!, bran: bran!, cy: cy!, style: style!.id, level: level!.id }
}

type Game = Awaited<ReturnType<typeof castingGame>>

// Une personne du jeu, avec une inscription à la session ; confirmée, elle est aussi dans le cast
async function player(game: Game, name: string, status: 'retained' | 'confirmed', extra: { answers?: Record<string, unknown>, affinities?: Array<{ kind: AffinityKind, text: string, targetParticipantId?: string }> } = {}) {
  const participant = await prisma.participant.create({ data: { name, slug: `${game.key}-${name.toLowerCase()}`, email: `${game.key}-${name.toLowerCase()}@example.test`, gameLinks: { create: { gameId: game.game.id } } } })
  const token = randomBytes(32).toString('base64url')
  const registration = await prisma.registration.create({
    data: {
      periodId: game.period.id, participantId: participant.id, status: 'received', source: 'form', email: participant.email!, links: { create: { tokenHash: sha256(token) } },
      sessionLines: { create: { sessionId: game.session.id, status, answer: 'available', announcedStatus: 'retained', responseDueAt: new Date(Date.now() + 7 * 86_400_000) } },
      questionAnswers: (extra.answers ?? {}) as object,
      affinities: { create: (extra.affinities ?? []).map((affinity, position) => ({ ...affinity, position })) }
    }
  })
  if (status === 'confirmed') await prisma.sessionParticipant.create({ data: { sessionId: game.session.id, participantId: participant.id, role: 'participant' } })
  return { participant, registration, token }
}

async function saveCast(game: Game, assignments: unknown[]) {
  const session = await prisma.session.findUniqueOrThrow({ where: { id: game.session.id } })
  const participants = await prisma.sessionParticipant.findMany({ where: { sessionId: game.session.id }, select: { participantId: true, role: true } })
  return await api(alice, 'PUT', `/api/sessions/${game.session.id}`, { name: session.name, gameId: game.game.id, participants, assignments }, { headers: { 'if-unmodified-since': session.updatedAt.toISOString() } })
}

describe('cadenas et réservation (US-100)', () => {
  it('garde le cadenas quand une ligne ne l’envoie pas, et le copie au report', async () => {
    const game = await castingGame()
    const lea = await player(game, 'Léa', 'confirmed')
    expect((await saveCast(game, [{ characterId: game.iseult.id, participantId: lea.participant.id, locked: true }])).status).toBe(200)
    // Les détails de la session renvoient les lignes sans cadenas
    const saved = await saveCast(game, [{ characterId: game.iseult.id, participantId: lea.participant.id }])
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(bodyOf<SavedSession>(saved).assignments[0]).toMatchObject({ locked: true, participantId: lea.participant.id })

    const postponed = await api(alice, 'POST', `/api/sessions/${game.session.id}/postpone`, { name: 'Reportée' })
    expect(postponed.status, JSON.stringify(postponed.body)).toBe(200)
    expect(await prisma.sessionAssignment.findFirst({ where: { sessionId: bodyOf<ApiResponse<'/api/sessions/:id/postpone', 'post'>>(postponed).id }, select: { locked: true } })).toEqual({ locked: true })
  })

  it('réserve un PJ à une personne retenue sans la faire entrer dans le cast ; elle le reçoit en confirmant', async () => {
    const game = await castingGame()
    const max = await player(game, 'Max', 'retained')
    const saved = await saveCast(game, [{ characterId: game.bran.id, reservedRegistrationId: max.registration.id }])
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(bodyOf<SavedSession>(saved).assignments[0]).toMatchObject({ participantId: null, reservedRegistrationId: max.registration.id, reservedRegistration: { participant: { name: 'Max' } } })
    expect(bodyOf<SavedSession>(saved).retainedRegistrations).toEqual([{ id: max.registration.id, participantId: max.participant.id, name: 'Max' }])
    expect(await prisma.sessionParticipant.count({ where: { sessionId: game.session.id, participantId: max.participant.id } })).toBe(0)

    expect((await publicApi('POST', `/api/public/registrations/${max.token}/accept`, { sessionId: game.session.id })).status).toBe(200)
    expect(await prisma.sessionAssignment.findFirst({ where: { sessionId: game.session.id, characterId: game.bran.id }, select: { participantId: true, reservedRegistrationId: true } }))
      .toEqual({ participantId: max.participant.id, reservedRegistrationId: null })
  })

  it('un désistement libère le personnage réservé ; une réservation d’un autre jeu est refusée', async () => {
    const game = await castingGame()
    const other = await castingGame()
    const zoe = await player(game, 'Zoé', 'retained')
    const stranger = await player(other, 'Noa', 'retained')
    expect((await saveCast(game, [{ characterId: game.cy.id, reservedRegistrationId: stranger.registration.id }])).status).toBe(400)
    expect((await saveCast(game, [{ characterId: game.cy.id, reservedRegistrationId: zoe.registration.id }])).status).toBe(200)
    expect((await api(alice, 'POST', `/api/registrations/${zoe.registration.id}/withdraw`, { sessionId: game.session.id })).status).toBe(200)
    expect(await prisma.sessionAssignment.findFirst({ where: { sessionId: game.session.id, characterId: game.cy.id }, select: { reservedRegistrationId: true } })).toEqual({ reservedRegistrationId: null })
  })

  it('libérer la place ou changer la décision de sélection libère le personnage réservé', async () => {
    const game = await castingGame()
    const lou = await player(game, 'Lou', 'retained')
    const noa = await player(game, 'Noa', 'retained')
    expect((await saveCast(game, [{ characterId: game.cy.id, reservedRegistrationId: lou.registration.id }, { characterId: game.bran.id, reservedRegistrationId: noa.registration.id }])).status).toBe(200)
    const released = await api(alice, 'POST', `/api/registrations/${lou.registration.id}/release`, { sessionId: game.session.id })
    expect(released.status, JSON.stringify(released.body)).toBe(200)
    const rejected = await api(alice, 'POST', `/api/registrations/${noa.registration.id}/selection`, { action: 'reset', sessionId: game.session.id })
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200)
    expect(await prisma.sessionAssignment.count({ where: { sessionId: game.session.id, reservedRegistrationId: { not: null } } })).toBe(0)
  })

  it('« un seul PJ par participant » compte les réservations', async () => {
    const game = await castingGame()
    await prisma.game.update({ where: { id: game.game.id }, data: { singlePjPerParticipant: true } })
    const max = await player(game, 'Max', 'retained')
    const refused = await saveCast(game, [
      { characterId: game.bran.id, reservedRegistrationId: max.registration.id },
      { characterId: game.cy.id, participantId: max.participant.id }
    ])
    expect(refused.status).toBe(400)
  })
})

describe('assistant de casting (US-101, US-102)', () => {
  it('note chaque paire, interdit une relation refusée, et propose une répartition sans rien écrire', async () => {
    const game = await castingGame()
    // Léa veut l'intrigue (Iseult) mais refuse les romances ; Max a 5 en expérience (faction d'Iseult)
    const lea = await player(game, 'Léa', 'confirmed', {
      answers: { [game.style]: 'Intrigue' },
      affinities: [{ kind: 'refusedRelationTypes', text: 'romance' }, { kind: 'refusedRelations', text: 'Pas de trahison' }]
    })
    const max = await player(game, 'Max', 'retained', { answers: { [game.level]: 5 } })

    const result = await api(alice, 'POST', `/api/sessions/${game.session.id}/casting-assistant`, { assignments: [] })
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    const pairs = bodyOf<CastingProposal>(result).pairs
    const leaIseult = pairs[lea.participant.id]?.find((pair) => pair.characterId === game.iseult.id)
    expect(leaIseult).toMatchObject({ score: 1, blocks: ['Relation refusée : Romance, avec Bran'] })
    expect(pairs[max.participant.id]?.find((pair) => pair.characterId === game.iseult.id))
      .toMatchObject({ score: 0.5, components: [{ label: '« Ton expérience » : 5/5 → faction Loups', points: 0.5 }] })

    const proposal = new Map(bodyOf<CastingProposal>(result).proposal.map((line) => [line.characterId, line]))
    expect(proposal.get(game.iseult.id)).toMatchObject({ playerId: max.participant.id, reservedRegistrationId: max.registration.id })
    expect([game.cy.id, game.bran.id].map((id) => proposal.get(id)!.playerId)).not.toContain(max.participant.id)
    expect(bodyOf<CastingProposal>(result).players.find((entry) => entry.id === lea.participant.id)?.refusedTexts).toEqual(['Pas de trahison'])
    expect(await prisma.sessionAssignment.count({ where: { sessionId: game.session.id } })).toBe(0)
  })

  it('respecte les lignes verrouillées et interdit la relation directe avec quelqu’un avec qui on ne veut pas jouer', async () => {
    const game = await castingGame()
    const lea = await player(game, 'Léa', 'confirmed')
    const max = await player(game, 'Max', 'confirmed', { answers: { [game.style]: 'Intrigue' }, affinities: [{ kind: 'notWith', text: 'Léa', targetParticipantId: lea.participant.id }] })
    const result = await api(alice, 'POST', `/api/sessions/${game.session.id}/casting-assistant`, {
      assignments: [{ characterId: game.bran.id, participantId: lea.participant.id, locked: true }]
    })
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    expect(bodyOf<CastingProposal>(result).avoidWarnings).toEqual([])
    const maxIseult = bodyOf<CastingProposal>(result).pairs[max.participant.id]?.find((pair) => pair.characterId === game.iseult.id)
    expect(maxIseult?.blocks[0]).toContain('Relation directe avec Bran, joué par Léa')
    const proposal = new Map(bodyOf<CastingProposal>(result).proposal.map((line) => [line.characterId, line.playerId]))
    expect(proposal.get(game.bran.id)).toBe(lea.participant.id)
    expect(proposal.get(game.iseult.id)).not.toBe(max.participant.id)
    expect(proposal.get(game.cy.id)).toBe(max.participant.id)
  })

  it('rappelle « ne veut pas croiser » quand les deux personnes sont dans la session', async () => {
    const game = await castingGame()
    const lea = await player(game, 'Léa', 'confirmed')
    await player(game, 'Max', 'retained', { affinities: [{ kind: 'avoid', text: 'Léa', targetParticipantId: lea.participant.id }] })
    const result = await api(alice, 'POST', `/api/sessions/${game.session.id}/casting-assistant`, { assignments: [] })
    expect(bodyOf<CastingProposal>(result).avoidWarnings).toEqual(['Max ne veut pas croiser Léa : les deux sont dans la session.'])
  })

  it('n’est ouvert qu’à l’équipe du jeu', async () => {
    const game = await castingGame()
    expect([403, 404]).toContain((await api(bob, 'POST', `/api/sessions/${game.session.id}/casting-assistant`, { assignments: [] })).status)
  })
})
