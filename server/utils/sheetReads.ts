import { labelNestedSessions, labelSession } from '~/server/utils/sessionLabels'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { accessibleGameIds, gameScopedWhere, requireGameAccess } from '~/server/utils/gameAccess'
import { documentInclude } from '~/server/utils/documents'
import { itemInclude } from '~/server/utils/items'
import { exposeParticipantGames, participantGameLinksInclude } from '~/server/utils/participants'
import { castAssignmentInclude, withCastReservations } from '~/server/utils/sessionAssignments'
import { timelineEventInclude, withTimelineConflicts } from '~/server/utils/timelineEvents'
import { unlinked } from '~/server/utils/contentLinks'

// Lecture d'une fiche, par identifiant (route `[id]`) ou par slug (route explicite `slug/[slug]`, pour les pages) :
// l'API n'accepte jamais l'un pour l'autre, un slug change avec le nom
export type SheetKey = { id: string } | { slug: string }

function notFound(message: string): never {
  throw createError({ statusCode: 404, message })
}

// Éléments reliés d'une fiche, par les tables de liaison qui portent le jeu (US-191) : la lecture passe par unlinked
export const characterSheetInclude = {
  game: true,
  intrigueLinks: { select: { intrigue: true }, orderBy: { intrigue: { updatedAt: 'desc' as const } } },
  factionLinks: { select: { faction: true } }
}

export const factionInclude = {
  game: true,
  characterLinks: { select: { character: true }, orderBy: { character: { name: 'asc' as const } } },
  intrigueLinks: { select: { intrigue: true }, orderBy: { intrigue: { updatedAt: 'desc' as const } } }
}

export const intrigueInclude = {
  game: true,
  characterLinks: { select: { character: true }, orderBy: { character: { name: 'asc' as const } } },
  factionLinks: { select: { faction: true }, orderBy: { faction: { name: 'asc' as const } } },
  itemLinks: { select: { item: true }, orderBy: { item: { name: 'asc' as const } } }
}

export async function readCharacter(event: H3Event, key: SheetKey) {
  const character = await prisma.character.findFirst({ where: await gameScopedWhere(event, key), include: characterSheetInclude })
  return unlinked(character ?? notFound('Introuvable'))
}

export async function readFaction(event: H3Event, key: SheetKey) {
  const faction = await prisma.faction.findFirst({ where: await gameScopedWhere(event, key), include: factionInclude })
  return unlinked(faction ?? notFound('Introuvable'))
}

export async function readIntrigue(event: H3Event, key: SheetKey) {
  const intrigue = await prisma.intrigue.findFirst({ where: await gameScopedWhere(event, key), include: intrigueInclude })
  return unlinked(intrigue ?? notFound('Introuvable'))
}

export async function readDocument(event: H3Event, key: SheetKey) {
  const document = await prisma.document.findFirst({ where: await gameScopedWhere(event, key), include: documentInclude })
  return unlinked(document ?? notFound('Document introuvable'))
}

export async function readItem(event: H3Event, key: SheetKey) {
  const item = await prisma.item.findFirst({ where: await gameScopedWhere(event, key), include: itemInclude })
  return unlinked(item ?? notFound('Objet introuvable'))
}

export async function readLocation(event: H3Event, key: SheetKey) {
  const location = await prisma.location.findFirst({ where: await gameScopedWhere(event, key), include: { game: true } })
  return location ?? notFound('Lieu introuvable')
}

export async function readParticipant(event: H3Event, key: SheetKey) {
  const gameIds = await accessibleGameIds(event)
  const participant = await prisma.participant.findFirst({ where: key, include: participantGameLinksInclude(gameIds) })
  if (!participant) notFound('Participant introuvable')
  if (gameIds !== null && !participant.gameLinks.length) {
    throw createError({ statusCode: 403, message: 'Participant inaccessible' })
  }
  return exposeParticipantGames(participant)
}

export async function readTimelineEvent(event: H3Event, key: SheetKey) {
  const timelineEvent = await prisma.timelineEvent.findFirst({ where: key, include: timelineEventInclude })
  if (!timelineEvent) notFound('Événement introuvable')
  await requireGameAccess(event, timelineEvent.gameId)

  // Conflits du créneau : les événements du même jour et de la même heure
  const relatedEvents = await prisma.timelineEvent.findMany({
    where: { gameId: timelineEvent.gameId, day: timelineEvent.day, time: timelineEvent.time },
    include: timelineEventInclude
  })
  return withTimelineConflicts(unlinked(relatedEvents)).find((related) => related.id === timelineEvent.id) ?? notFound('Événement introuvable')
}

export async function readSession(event: H3Event, key: SheetKey) {
  const session = await prisma.session.findFirst({
    where: await gameScopedWhere(event, key),
    include: {
      game: true,
      location: true,
      // Report (US-022) : session de destination et d'origine
      postponedTo: { select: { id: true, slug: true, date: true } },
      postponedFrom: { select: { id: true, slug: true, date: true } },
      participants: { include: { participant: true } },
      assignments: { include: castAssignmentInclude, orderBy: { characterId: 'asc' } }
    }
  })
  // Elle et les sessions de son report, avec leur libellé (SPEC-021)
  const found = await labelNestedSessions(prisma, await withCastReservations(session ?? notFound('Session introuvable')))
  return await labelSession(prisma, found)
}
