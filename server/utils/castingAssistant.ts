import { prisma } from '~/server/utils/prisma'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { currentQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { castingAssistant, type CastingCharacter, type CastingPlayer } from '~/utils/castingAssistant'
import { manualRetainRoom, replayerParticipantIds } from '~/server/utils/registrationSelection'
import { CHARACTER_TYPES, REGISTRATION_REPLAY_POLICIES, REGISTRATION_SESSION_STATUSES, REGISTRATION_STATUSES, SESSION_ROLES } from '~/utils/domain'
import { unlinked } from '~/server/utils/contentLinks'
import { byName, withGameValuesIn } from '~/server/utils/participantValues'

// Assistant de casting d'une session (US-101, US-102, ADR-0051) : calculé sur le cast en cours d'édition, rien n'est écrit

type CastLine = { characterId: string, participantId?: string | null, reservedRegistrationId?: string | null, locked?: boolean }

const nameSelect = { select: { id: true, name: true } } as const

export async function gameCharacters(gameId: string): Promise<CastingCharacter[]> {
  const rows = await prisma.character.findMany({
    where: { gameId, type: CHARACTER_TYPES.pj },
    select: {
      id: true,
      name: true,
      factionLinks: { select: { faction: nameSelect } },
      intrigueLinks: { select: { intrigue: nameSelect } },
      relationsFrom: { select: { type: true, toCharacter: nameSelect } },
      relationsTo: { select: { type: true, fromCharacter: nameSelect } }
    },
    orderBy: { name: 'asc' }
  })
  return unlinked(rows).map(({ relationsFrom, relationsTo, ...character }) => ({
    ...character,
    relations: [
      ...relationsFrom.map((relation) => ({ otherId: relation.toCharacter.id, otherName: relation.toCharacter.name, type: relation.type })),
      ...relationsTo.map((relation) => ({ otherId: relation.fromCharacter.id, otherName: relation.fromCharacter.name, type: relation.type }))
    ]
  }))
}

/**
 * Propose le cast parmi ses joueurs, les personnes retenues, les pré-inscrites et celles déjà placées dans le formulaire
 * (R21). Les autres personnes du vivier n'y sont pas. Une pré-inscrite proposée sera retenue à l'enregistrement : pas
 * plus que ce que `manualRetainRoom` permet, les autres sont listées avec la raison.
 */
export async function sessionCastingAssistant(session: { id: string, gameId: string }, lines: CastLine[], userId: string) {
  const { id: sessionId, gameId } = session
  const [characters, castPlayers, retainedLines, preregisteredLines, retainRoom, { definition }, links] = await Promise.all([
    gameCharacters(gameId),
    prisma.sessionParticipant.findMany({ where: { sessionId, role: SESSION_ROLES.participant }, select: { participantId: true } }),
    prisma.registrationSession.findMany({ where: { sessionId, status: REGISTRATION_SESSION_STATUSES.retained }, select: { registration: { select: { id: true, participantId: true } } } }),
    prisma.registrationSession.findMany({ where: { sessionId, status: REGISTRATION_SESSION_STATUSES.preregistered, registration: { status: REGISTRATION_STATUSES.received } }, select: { registration: { select: { id: true, participantId: true } } } }),
    manualRetainRoom(gameId, sessionId, userId),
    getCurrentRegistrationForm(gameId),
    currentQuestionLinks(gameId)
  ])
  const retained = retainedLines.map((line) => line.registration)
  const characterIds = new Set(characters.map((character) => character.id))
  const pjLines = lines.filter((line) => characterIds.has(line.characterId))
  // Les lignes ne citent que des personnages du jeu (les PNJ sont ignorés)
  const otherIds = [...new Set(lines.map((line) => line.characterId).filter((id) => !characterIds.has(id)))]
  if (otherIds.length && await prisma.character.count({ where: { gameId, id: { in: otherIds } } }) !== otherIds.length) {
    throw createError({ statusCode: 400, message: 'Un personnage du cast n’appartient pas au jeu de la session' })
  }

  // Une réservation vise une inscription retenue de la session, ou une personne du vivier choisie dans le formulaire,
  // qui sera retenue à l'enregistrement (R20)
  const retainedIds = new Set(retained.map((registration) => registration.id))
  const chosenIds = [...new Set(pjLines.map((line) => line.reservedRegistrationId).filter((id): id is string => Boolean(id && !retainedIds.has(id))))]
  const chosen = chosenIds.length
    ? await prisma.registration.findMany({ where: { id: { in: chosenIds }, status: REGISTRATION_STATUSES.received, period: { gameId } }, select: { id: true, participantId: true } })
    : []
  // Déjà dans le cast ou retenue, une personne n'est plus à retenir. Une rejoueuse exclue ne se propose pas : l'équipe peut
  // seulement la retenir elle-même (R24)
  const seated = new Set([...castPlayers.map((player) => player.participantId), ...retained.map((registration) => registration.participantId)])
  const period = await prisma.registrationPeriod.findUnique({ where: { gameId }, select: { replayPolicy: true } })
  const excluded = period?.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded
    ? await replayerParticipantIds(gameId, preregisteredLines.map((line) => line.registration.participantId))
    : new Set<string>()
  const preregistered = preregisteredLines.map((line) => line.registration)
    .filter((registration) => !seated.has(registration.participantId) && !excluded.has(registration.participantId))
  const reservations = [...new Map([...retained, ...chosen, ...preregistered].map((registration) => [registration.id, registration])).values()]
  const reservedParticipant = new Map(reservations.map((registration) => [registration.id, registration.participantId]))
  const reservationOf = new Map(reservations.map((registration) => [registration.participantId, registration.id]))
  const holderOf = (line: CastLine) => line.participantId || (line.reservedRegistrationId && reservedParticipant.get(line.reservedRegistrationId)) || null

  // Joueurs : le cast, les personnes retenues non confirmées, et celles déjà placées dans le formulaire, du même jeu
  const candidateIds = [...new Set([
    ...castPlayers.map((player) => player.participantId),
    ...retained.map((registration) => registration.participantId),
    ...preregistered.map((registration) => registration.participantId),
    ...pjLines.map(holderOf).filter((id): id is string => Boolean(id))
  ])]
  const [people, registrations] = await Promise.all([
    // Nom tenu par l'équipe du jeu, trié à l'affichage (ADR-0086)
    prisma.participant.findMany({ where: { id: { in: candidateIds }, gameLinks: { some: { gameId } } }, select: { id: true, name: true } })
      .then((rows) => withGameValuesIn(rows, gameId)).then((rows) => rows.sort(byName)),
    prisma.registration.findMany({
      where: { participantId: { in: candidateIds }, period: { gameId } },
      select: {
        participantId: true,
        questionAnswers: true,
        affinities: { select: { kind: true, text: true, targetParticipantId: true }, orderBy: { position: 'asc' } }
      }
    })
  ])
  // Une seule réponse par personne et par vivier (R1)
  const registrationByParticipant = new Map(registrations.map((registration) => [registration.participantId, registration]))

  const players = people.map((person) => {
    const registration = registrationByParticipant.get(person.id) ?? null
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

  // Personnes que l'enregistrement retiendrait : sans aucune marge, elles n'entrent pas dans la répartition et n'y
  // prennent pas le personnage d'une personne déjà retenue
  const toRetain = new Set([...preregistered, ...chosen].map((registration) => registration.participantId).filter((id) => !seated.has(id)))
  const held = new Set(pjLines.map(holderOf))
  const leftOut = new Set(retainRoom.room === 0 ? [...toRetain].filter((id) => !held.has(id)) : [])
  const distribute = () => castingAssistant({
    players: players.map(({ player }) => player).filter((player) => !leftOut.has(player.id)),
    characters,
    questions: definition.questions.map(({ id, label, type }) => ({ id, label, type })),
    links,
    locked
  })
  let result = distribute()
  // Au-delà de la marge, les moins bien notées sortent, et l'on répartit de nouveau : une personne déjà retenue ne perd pas
  // son personnage pour une pré-inscrite qui ne pourrait pas être retenue
  while (true) {
    const lockedCount = result.proposal.filter((line) => line.locked && line.playerId && toRetain.has(line.playerId)).length
    const proposed = result.proposal
      .filter((line) => !line.locked && line.playerId && toRetain.has(line.playerId))
      .sort((left, right) => right.score - left.score)
    const over = proposed.slice(Math.max(0, retainRoom.room - lockedCount))
    if (!over.length) break
    for (const line of over) leftOut.add(line.playerId!)
    result = distribute()
  }

  // « Ne veut pas croiser » reste une alerte de la sélection (R25) : l'assistant la rappelle, pour les personnes qui ont une
  // place ou que la proposition place ; une pré-inscrite restée sans personnage n'est pas dans la session
  const present = new Set<string | null>([...seated, ...held, ...result.proposal.map((line) => line.playerId)])
  const avoidWarnings = players.filter(({ player }) => present.has(player.id)).flatMap(({ player, avoidIds }) => avoidIds
    .filter((id) => present.has(id))
    .map((id) => `${player.name} ne veut pas croiser ${names.get(id)} : les deux sont dans la session.`))

  return {
    players: players.map(({ player, refusedTexts, hasAnswers }) => ({
      id: player.id,
      name: player.name,
      reservedRegistrationId: reservationOf.get(player.id) ?? null,
      // Pas encore retenue : l'enregistrement du cast le ferait
      toRetain: toRetain.has(player.id),
      refusedTexts,
      hasAnswers
    })),
    characters: characters.map(({ id, name }) => ({ id, name })),
    pairs: result.pairs,
    proposal: result.proposal.map((line) => ({ ...line, reservedRegistrationId: line.playerId ? reservationOf.get(line.playerId) ?? null : null })),
    unplaced: [...result.unplaced, ...[...leftOut].map((playerId) => ({ playerId, reason: retainRoom.reason }))],
    lockedConflicts: result.lockedConflicts,
    avoidWarnings
  }
}
