import { prisma } from '~/server/utils/prisma'
import { replayerParticipantIds } from '~/server/utils/registrationSelection'
import { CHARACTER_TYPES, REGISTRATION_REPLAY_POLICIES, REGISTRATION_SEAT_STATUSES, REGISTRATION_SESSION_STATUSES, REGISTRATION_STATUSES, SESSION_CAST_ROLES, SESSION_ROLES, SESSION_STATUSES } from '~/utils/domain'
import { byName, namesIn } from '~/server/utils/participantValues'

type SessionParticipantRole = typeof SESSION_ROLES[keyof typeof SESSION_ROLES]

export function normalizeAssignments(assignments: Array<{
  characterId: string
  participantId?: string | null
  photoUrl?: string | null
  notes?: string | null
  locked?: boolean
  reservedRegistrationId?: string | null
}> | undefined) {
  if (!Array.isArray(assignments)) return []

  const seen = new Set<string>()
  const normalized: Array<{
    characterId: string
    participantId: string | null
    photoUrl: string | null
    notes: string | null
    // Absents : la ligne garde son cadenas et sa réservation enregistrés (ADR-0051)
    locked?: boolean
    reservedRegistrationId?: string | null
  }> = []

  for (const assignment of assignments) {
    if (!assignment.characterId || seen.has(assignment.characterId)) continue

    seen.add(assignment.characterId)
    normalized.push({
      characterId: assignment.characterId,
      participantId: assignment.participantId || null,
      photoUrl: assignment.photoUrl || null,
      notes: assignment.notes || null,
      locked: assignment.locked,
      reservedRegistrationId: assignment.reservedRegistrationId === undefined ? undefined : assignment.reservedRegistrationId || null
    })
  }

  return normalized
}

/**
 * Cadenas et réservations des lignes du cast (US-100, ADR-0051). Une ligne qui ne les envoie pas garde ceux enregistrés.
 * Une réservation vise une inscription de cette session, et seulement une ligne sans joueur ; celle d'une inscription
 * confirmée entre-temps devient une attribution, celle d'une inscription qui n'est plus retenue pour la session
 * disparaît. Une réservation nouvelle pour une personne du vivier pas encore retenue la retient (R20) : `toRetain`, à
 * écrire avec le cast.
 */
export async function resolveCastLines(gameId: string, sessionId: string | null, assignments: ReturnType<typeof normalizeAssignments>) {
  const previous = new Map(sessionId
    ? (await prisma.sessionAssignment.findMany({ where: { sessionId }, select: { characterId: true, locked: true, reservedRegistrationId: true } }))
        .map((row) => [row.characterId, row])
    : [])
  const lines = assignments.map((assignment) => ({
    ...assignment,
    locked: assignment.locked ?? previous.get(assignment.characterId)?.locked ?? false,
    reservedRegistrationId: assignment.participantId
      ? null
      : assignment.reservedRegistrationId === undefined ? previous.get(assignment.characterId)?.reservedRegistrationId ?? null : assignment.reservedRegistrationId
  }))

  const reservationIds = [...new Set(lines.map((line) => line.reservedRegistrationId).filter((id): id is string => Boolean(id)))]
  const registrations = new Map((reservationIds.length
    ? await prisma.registration.findMany({
        where: { id: { in: reservationIds } },
        select: {
          id: true,
          participantId: true,
          period: { select: { gameId: true } },
          sessionLines: { where: { sessionId: sessionId ?? '' }, select: { status: true } }
        }
      })
    : []).map((registration) => [registration.id, registration]))
  const reservedParticipants = new Map<string, string>()
  const toRetain = new Set<string>()
  for (const line of lines) {
    if (!line.reservedRegistrationId) continue
    const registration = registrations.get(line.reservedRegistrationId)
    if (!registration || registration.period.gameId !== gameId) {
      throw createError({ statusCode: 400, message: 'Une réservation vise une inscription d’un autre jeu.' })
    }
    const status = registration.sessionLines[0]?.status
    if (status === REGISTRATION_SESSION_STATUSES.confirmed) {
      line.participantId = registration.participantId
      line.reservedRegistrationId = null
    } else if (status === REGISTRATION_SESSION_STATUSES.retained) {
      reservedParticipants.set(line.characterId, registration.participantId)
    } else if (sessionId && line.reservedRegistrationId !== previous.get(line.characterId)?.reservedRegistrationId) {
      reservedParticipants.set(line.characterId, registration.participantId)
      toRetain.add(line.reservedRegistrationId)
    } else {
      line.reservedRegistrationId = null
    }
  }
  return { lines, reservedParticipants, toRetain: [...toRetain] }
}

export function normalizeSessionParticipants(participants: Array<{
  participantId: string
  role: SessionParticipantRole
}> | undefined, assignments: ReturnType<typeof normalizeAssignments>) {
  const normalized = new Map<string, { participantId: string, role: SessionParticipantRole }>()

  for (const participant of Array.isArray(participants) ? participants : []) {
    if (!participant.participantId) continue
    normalized.set(`${participant.participantId}:${participant.role}`, {
      participantId: participant.participantId,
      role: participant.role
    })
  }

  for (const assignment of assignments) {
    if (!assignment.participantId) continue

    const hasCastRole = SESSION_CAST_ROLES.some((role) => normalized.has(`${assignment.participantId}:${role}`))
    if (!hasCastRole) {
      normalized.set(`${assignment.participantId}:${SESSION_ROLES.participant}`, {
        participantId: assignment.participantId,
        role: SESSION_ROLES.participant
      })
    }
  }

  return [...normalized.values()]
}

export async function assertSessionLocation(gameId: string, locationId?: string | null) {
  if (!locationId) return

  const location = await prisma.location.findFirst({
    where: { id: locationId, gameId },
    select: { id: true }
  })
  if (!location) {
    throw createError({ statusCode: 400, message: 'Lieu invalide pour ce jeu' })
  }
}

export async function assertSessionCastRules(
  gameId: string,
  sessionParticipants: ReturnType<typeof normalizeSessionParticipants>,
  assignments: ReturnType<typeof normalizeAssignments>,
  // Personnages réservés à une personne retenue : comptés pour « un seul PJ par participant » (US-100)
  reservedParticipants: Map<string, string> = new Map()
) {
  const participantIds = [...new Set([
    ...sessionParticipants.map((participant) => participant.participantId),
    ...assignments
      .map((assignment) => assignment.participantId)
      .filter((participantId): participantId is string => Boolean(participantId))
  ])]

  if (participantIds.length) {
    const registeredParticipants = await prisma.participant.count({
      where: {
        id: { in: participantIds },
        gameLinks: { some: { gameId } }
      }
    })

    if (registeredParticipants !== participantIds.length) {
      throw createError({
        statusCode: 400,
        message: 'Un participant assigné n’est pas inscrit au jeu de la session'
      })
    }
  }

  // Une personne qui a refusé l'usage de sa photo n'en reçoit pas dans le cast (US-109)
  const withPhoto = [...new Set(assignments.filter((assignment) => assignment.photoUrl && assignment.participantId).map((assignment) => assignment.participantId!))]
  if (withPhoto.length) {
    const refusing = await prisma.participant.findFirst({ where: { id: { in: withPhoto }, photoRefusedAt: { not: null } }, select: { id: true } })
    if (refusing) {
      // Nom tenu par l'équipe du jeu (ADR-0086)
      const name = (await namesIn(gameId, [refusing.id])).get(refusing.id)
      throw createError({ statusCode: 400, message: `${name} a refusé l’usage de sa photo : retirez la photo de sa ligne du cast.` })
    }
  }

  const characterIds = [...new Set(assignments.map((assignment) => assignment.characterId))]
  if (!characterIds.length) return

  const characters = await prisma.character.findMany({
    where: {
      id: { in: characterIds },
      gameId
    },
    select: {
      id: true,
      type: true
    }
  })
  const charactersById = new Map(characters.map((character) => [character.id, character]))

  if (characters.length !== characterIds.length) {
    throw createError({
      statusCode: 400,
      message: 'Un personnage assigné n’appartient pas au jeu de la session'
    })
  }

  const pnjCastableParticipantIds = new Set(
    sessionParticipants
      .filter((participant) => participant.role === SESSION_ROLES.organizer || participant.role === SESSION_ROLES.npc)
      .map((participant) => participant.participantId)
  )

  for (const characterId of reservedParticipants.keys()) {
    if (charactersById.get(characterId)?.type === CHARACTER_TYPES.pnj) {
      throw createError({ statusCode: 400, message: 'Seul un personnage PJ peut être réservé à une personne retenue.' })
    }
  }

  for (const assignment of assignments) {
    if (!assignment.participantId) continue

    const character = charactersById.get(assignment.characterId)
    if (character?.type === CHARACTER_TYPES.pnj && !pnjCastableParticipantIds.has(assignment.participantId)) {
      throw createError({
        statusCode: 400,
        message: 'Un rôle PNJ ne peut être assigné qu’à un organisateur ou un PNJ de session'
      })
    }
  }

  // Un seul PJ par participant, sauf jeu en plusieurs actes (US-017) ; les PNJ ne sont pas limités
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { singlePjPerParticipant: true } })
  if (game?.singlePjPerParticipant) {
    const holders = assignments.map((assignment) => ({ ...assignment, participantId: assignment.participantId ?? reservedParticipants.get(assignment.characterId) ?? null }))
    const participantId = participantWithSeveralPjs(holders, charactersById)
    if (participantId) {
      const name = (await namesIn(gameId, [participantId])).get(participantId)
      throw createError({
        statusCode: 400,
        message: `${name ?? 'Un participant'} joue plusieurs PJ dans cette session : ce jeu n’en permet qu’un par participant (réglage du jeu).`
      })
    }
  }
}

/**
 * Un joueur passe par le questionnaire (R31, ADR-0069) : un nouveau joueur de la session doit y être inscrit. Ceux déjà
 * dans la session restent, et les rôles d'équipe s'ajoutent à la main : un PNJ ou une organisatrice peut reprendre un
 * PJ sans devenir joueur.
 * Appelé après le contrôle du jeu : le nom lu est celui d'une personne de ce jeu.
 */
export async function assertPlayersFromPool(gameId: string, sessionId: string | null, sessionParticipants: ReturnType<typeof normalizeSessionParticipants>) {
  const players = sessionParticipants.filter((participant) => participant.role === SESSION_ROLES.participant).map((participant) => participant.participantId)
  if (!players.length) return
  const current = sessionId
    ? await prisma.sessionParticipant.findMany({ where: { sessionId, role: SESSION_ROLES.participant, participantId: { in: players } }, select: { participantId: true } })
    : []
  const known = new Set(current.map((row) => row.participantId))
  const newcomers = players.filter((id) => !known.has(id))
  if (!newcomers.length) return

  const [people, names] = await Promise.all([prisma.participant.findMany({
    where: { id: { in: newcomers } },
    select: {
      id: true,
      registrations: {
        where: { period: { gameId }, status: REGISTRATION_STATUSES.received },
        select: { sessionLines: { where: { sessionId: sessionId ?? '', status: REGISTRATION_SESSION_STATUSES.confirmed }, select: { id: true } } }
      }
    }
  }), namesIn(gameId, newcomers)])
  // Nom tenu par l'équipe du jeu (ADR-0086)
  for (const { id, registrations } of people) {
    const name = names.get(id)
    const [registration] = registrations
    if (!registration) {
      throw createError({ statusCode: 400, message: `${name} n’est pas dans le vivier de ce jeu : un joueur répond d’abord au questionnaire. Invitez cette personne à le remplir, ou donnez-lui le rôle de PNJ ou d’organisation pour tenir un personnage sans questionnaire.` })
    }
    if (!registration.sessionLines.length) {
      throw createError({ statusCode: 400, message: `${name} est dans le vivier sans être inscrite à cette session : retenez cette personne si ce n’est pas fait. Elle entre dans la session en confirmant sa place, et son personnage se réserve dans l’onglet Cast.` })
    }
  }
}

// Premier participant qui joue plus d'un PJ dans la session, ou null
export function participantWithSeveralPjs(
  assignments: Array<{ characterId: string, participantId: string | null }>,
  charactersById: Map<string, { type: string }>
) {
  const seen = new Set<string>()
  for (const assignment of assignments) {
    if (!assignment.participantId || charactersById.get(assignment.characterId)?.type === CHARACTER_TYPES.pnj) continue
    if (seen.has(assignment.participantId)) return assignment.participantId
    seen.add(assignment.participantId)
  }
  return null
}

// Lignes du cast avec leur réservation (US-100)
export const castAssignmentInclude = {
  character: true,
  participant: true,
  reservedRegistration: { select: { id: true, participant: { select: { id: true, name: true } } } }
} as const

type ReservedRow = { reservedRegistrationId: string | null, reservedRegistration?: { id: string } | null }

/**
 * Personnes du vivier que le cast peut ajouter à la session (R20) : sans rôle qui tient déjà un personnage, sans place,
 * et sans annulation tant qu'elles ne s'y redisent pas disponibles (R19). Le statut et le fait d'avoir déjà joué, quand
 * le vivier le signale, s'affichent à côté du nom (R20, R24).
 */
async function poolCandidates(session: { id: string, gameId: string }, period: { id: string, replayPolicy: string }) {
  const rows = await prisma.registration.findMany({
    where: {
      status: REGISTRATION_STATUSES.received,
      periodId: period.id,
      participant: { sessionRoles: { none: { sessionId: session.id, role: { in: SESSION_CAST_ROLES } } } },
      sessionLines: { none: { sessionId: session.id, status: { in: [...REGISTRATION_SEAT_STATUSES, REGISTRATION_SESSION_STATUSES.cancelled] } } }
    },
    select: {
      id: true,
      participantId: true,
      sessionLines: { where: { sessionId: session.id }, select: { status: true } }
    }
  })
  const replayers = period.replayPolicy === REGISTRATION_REPLAY_POLICIES.allowed
    ? new Set<string>()
    : await replayerParticipantIds(session.gameId, rows.map((row) => row.participantId))
  // Nom tenu par l'équipe du jeu, trié à l'affichage (ADR-0086)
  const names = await namesIn(session.gameId, rows.map((row) => row.participantId))
  return rows.map((row) => ({
    id: row.id,
    name: names.get(row.participantId) ?? '',
    status: row.sessionLines[0]?.status ?? REGISTRATION_STATUSES.received,
    replayer: replayers.has(row.participantId)
  })).sort(byName)
}

/**
 * Session lue par l'équipe : une réservation dont la personne n'est plus retenue pour la session n'est plus montrée,
 * et les personnes retenues non confirmées (US-100, ADR-0051) comme les autres personnes du vivier (US-176) sont listées
 * pour être choisies dans le cast, seulement sur une session encore prévue. L'état du vivier dit si le cast peut inviter.
 */
export async function withCastReservations<T extends { id: string, gameId: string, status: string, assignments: ReservedRow[] }>(session: T) {
  const [retained, period] = await Promise.all([
    prisma.registrationSession.findMany({
      where: { sessionId: session.id, status: REGISTRATION_SESSION_STATUSES.retained },
      select: { registration: { select: { id: true, participantId: true } } }
    }),
    prisma.registrationPeriod.findUnique({ where: { gameId: session.gameId }, select: { id: true, state: true, replayPolicy: true } })
  ])
  const [pool, retainedNames] = await Promise.all([
    period && session.status === SESSION_STATUSES.scheduled ? poolCandidates(session, period) : [],
    namesIn(session.gameId, retained.map((line) => line.registration.participantId))
  ])
  const retainedIds = new Set(retained.map((line) => line.registration.id))
  return {
    ...session,
    // Chaque ligne garde son type (personnage, participant…) : la réponse de la route le reprend
    assignments: session.assignments.map((assignment): T['assignments'][number] => {
      const live = Boolean(assignment.reservedRegistration) && retainedIds.has(assignment.reservedRegistration!.id)
      return live ? assignment : { ...assignment, reservedRegistrationId: null, reservedRegistration: null }
    }),
    retainedRegistrations: retained
      .map(({ registration }) => ({ id: registration.id, participantId: registration.participantId, name: retainedNames.get(registration.participantId) ?? '' }))
      .sort(byName),
    poolRegistrations: pool,
    poolState: period?.state ?? null
  }
}
