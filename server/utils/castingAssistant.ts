import { prisma } from '~/server/utils/prisma'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { currentQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { castingAssistant, type CastingCharacter, type CastingPlayer } from '~/utils/castingAssistant'
import { CHARACTER_TYPES, REGISTRATION_STATUSES, SESSION_ROLES } from '~/utils/domain'

// Assistant de casting d'une session (US-101, US-102, ADR-0051) : calculé sur le cast en cours d'édition, rien n'est écrit

type CastLine = { characterId: string, participantId?: string | null, reservedRegistrationId?: string | null, locked?: boolean }

const PLACED_STATUSES: string[] = [REGISTRATION_STATUSES.retained, REGISTRATION_STATUSES.confirmed]
const nameSelect = { select: { id: true, name: true } } as const

async function gameCharacters(gameId: string): Promise<CastingCharacter[]> {
  const rows = await prisma.character.findMany({
    where: { gameId, type: CHARACTER_TYPES.pj },
    select: {
      id: true,
      name: true,
      factions: nameSelect,
      intrigues: nameSelect,
      relationsFrom: { select: { type: true, toCharacter: nameSelect } },
      relationsTo: { select: { type: true, fromCharacter: nameSelect } }
    },
    orderBy: { name: 'asc' }
  })
  return rows.map(({ relationsFrom, relationsTo, ...character }) => ({
    ...character,
    relations: [
      ...relationsFrom.map((relation) => ({ otherId: relation.toCharacter.id, otherName: relation.toCharacter.name, type: relation.type })),
      ...relationsTo.map((relation) => ({ otherId: relation.fromCharacter.id, otherName: relation.fromCharacter.name, type: relation.type }))
    ]
  }))
}

export async function sessionCastingAssistant(session: { id: string, gameId: string }, lines: CastLine[]) {
  const { id: sessionId, gameId } = session
  const [characters, castPlayers, retained, { definition }, links] = await Promise.all([
    gameCharacters(gameId),
    prisma.sessionParticipant.findMany({ where: { sessionId, role: SESSION_ROLES.participant }, select: { participantId: true } }),
    prisma.registration.findMany({ where: { sessionId, status: REGISTRATION_STATUSES.retained }, select: { id: true, participantId: true } }),
    getCurrentRegistrationForm(gameId),
    currentQuestionLinks(gameId)
  ])
  const characterIds = new Set(characters.map((character) => character.id))
  const pjLines = lines.filter((line) => characterIds.has(line.characterId))
  // Les lignes ne citent que des personnages du jeu (les PNJ sont ignorés)
  const otherIds = [...new Set(lines.map((line) => line.characterId).filter((id) => !characterIds.has(id)))]
  if (otherIds.length && await prisma.character.count({ where: { gameId, id: { in: otherIds } } }) !== otherIds.length) {
    throw createError({ statusCode: 400, message: 'Un personnage du cast n’appartient pas au jeu de la session' })
  }

  // Une réservation n'a de sens que pour une inscription retenue de la session
  const reservedParticipant = new Map(retained.map((registration) => [registration.id, registration.participantId]))
  const reservationOf = new Map(retained.map((registration) => [registration.participantId, registration.id]))
  const holderOf = (line: CastLine) => line.participantId || (line.reservedRegistrationId && reservedParticipant.get(line.reservedRegistrationId)) || null

  // Joueurs : le cast, les personnes retenues non confirmées, et celles déjà placées dans le formulaire, du même jeu
  const candidateIds = [...new Set([
    ...castPlayers.map((player) => player.participantId),
    ...retained.map((registration) => registration.participantId),
    ...pjLines.map(holderOf).filter((id): id is string => Boolean(id))
  ])]
  const [people, registrations] = await Promise.all([
    prisma.participant.findMany({ where: { id: { in: candidateIds }, gameLinks: { some: { gameId } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.registration.findMany({
      where: { participantId: { in: candidateIds }, period: { gameId } },
      select: {
        participantId: true,
        sessionId: true,
        status: true,
        questionAnswers: true,
        affinities: { select: { kind: true, text: true, targetParticipantId: true }, orderBy: { position: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    })
  ])
  // Réponses de son inscription à cette session, sinon de sa dernière inscription au jeu
  const registrationOf = (participantId: string) => {
    const own = registrations.filter((registration) => registration.participantId === participantId)
    return own.find((registration) => registration.sessionId === sessionId && PLACED_STATUSES.includes(registration.status)) ?? own[0] ?? null
  }

  const players = people.map((person) => {
    const registration = registrationOf(person.id)
    const affinities = registration?.affinities ?? []
    const targets = (kind: string) => affinities.filter((affinity) => affinity.kind === kind && affinity.targetParticipantId).map((affinity) => affinity.targetParticipantId!)
    return {
      player: {
        id: person.id,
        name: person.name,
        answers: (registration?.questionAnswers ?? {}) as Record<string, unknown>,
        refusedTypes: affinities.filter((affinity) => affinity.kind === 'refusedRelationTypes').map((affinity) => affinity.text),
        notWithIds: targets('notWith')
      } satisfies CastingPlayer,
      avoidIds: targets('avoid'),
      refusedTexts: affinities.filter((affinity) => affinity.kind === 'refusedRelations').map((affinity) => affinity.text),
      hasAnswers: Boolean(registration?.questionAnswers)
    }
  })
  const playerIds = new Set(people.map((person) => person.id))
  if (pjLines.some((line) => line.participantId && !playerIds.has(line.participantId))) {
    throw createError({ statusCode: 400, message: 'Un participant du cast n’est pas inscrit au jeu de la session' })
  }
  const names = new Map(people.map((person) => [person.id, person.name]))

  const locked = new Map<string, string | null>()
  for (const line of pjLines) {
    if (!line.locked) continue
    const holder = holderOf(line)
    locked.set(line.characterId, holder && playerIds.has(holder) ? holder : null)
  }

  const result = castingAssistant({
    players: players.map(({ player }) => player),
    characters,
    questions: definition.questions.map(({ id, label, type }) => ({ id, label, type })),
    links,
    locked
  })

  // « Ne veut pas croiser » reste une alerte de la sélection (R25) : l'assistant la rappelle
  const avoidWarnings = players.flatMap(({ player, avoidIds }) => avoidIds
    .filter((id) => playerIds.has(id))
    .map((id) => `${player.name} ne veut pas croiser ${names.get(id)} : les deux sont dans la session.`))

  return {
    players: players.map(({ player, refusedTexts, hasAnswers }) => ({
      id: player.id,
      name: player.name,
      reservedRegistrationId: reservationOf.get(player.id) ?? null,
      refusedTexts,
      hasAnswers
    })),
    characters: characters.map(({ id, name }) => ({ id, name })),
    pairs: result.pairs,
    proposal: result.proposal.map((line) => ({ ...line, reservedRegistrationId: line.playerId ? reservationOf.get(line.playerId) ?? null : null })),
    unplaced: result.unplaced,
    lockedConflicts: result.lockedConflicts,
    avoidWarnings
  }
}
