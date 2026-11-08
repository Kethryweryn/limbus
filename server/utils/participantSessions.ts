import { prisma } from '~/server/utils/prisma'

const sessionSelect = { select: { id: true, slug: true, name: true, date: true, gameId: true } } as const

/**
 * Sessions d'une personne dans les jeux accessibles (SPEC-007, R1c) : chaque session où elle a un rôle (joueuse, PNJ,
 * organisation, cuisine) ou tient un personnage, passées comprises, dans l'ordre des dates. L'accès à la fiche est
 * vérifié par l'appelant.
 */
export async function readParticipantSessions(participantId: string, gameIds: string[] | null) {
  const session = gameIds === null ? {} : { gameId: { in: gameIds } }
  const [roles, assignments] = await Promise.all([
    prisma.sessionParticipant.findMany({ where: { participantId, session }, select: { role: true, session: sessionSelect } }),
    prisma.sessionAssignment.findMany({ where: { participantId, session }, select: { character: { select: { name: true } }, session: sessionSelect } })
  ])

  type SessionRow = (typeof roles)[number]['session']
  const sessions = new Map<string, SessionRow & { roles: string[], characters: string[] }>()
  const rowOf = (value: SessionRow) => {
    let row = sessions.get(value.id)
    if (!row) sessions.set(value.id, row = { ...value, roles: [], characters: [] })
    return row
  }
  for (const { role, session: value } of roles) rowOf(value).roles.push(role)
  for (const { character, session: value } of assignments) rowOf(value).characters.push(character.name)

  // Les sessions sans date en dernier
  return [...sessions.values()].sort((left, right) => (left.date?.getTime() ?? Infinity) - (right.date?.getTime() ?? Infinity))
}
