import { prisma } from '~/server/utils/prisma'

export const timelineEventInclude = {
  game: true,
  characters: {
    orderBy: [{ type: 'asc' as const }, { name: 'asc' as const }],
    include: {
      factions: {
        orderBy: { name: 'asc' as const }
      }
    }
  },
  factions: {
    orderBy: { name: 'asc' as const }
  },
  intrigues: {
    orderBy: { name: 'asc' as const }
  },
  items: {
    orderBy: { name: 'asc' as const }
  }
}

type TimelineEventWithRelations = {
  id: string
  name: string
  day: number
  time: string
  characters?: Array<{ id: string, name: string }>
  items?: Array<{ id: string, name: string }>
}

type ConflictResource = {
  type: 'character' | 'item'
  id: string
  name: string
  eventIds: string[]
  eventNames: string[]
}

export async function validateTimelineEventRelations(gameId: string, characterIds: string[], factionIds: string[], intrigueIds: string[], itemIds: string[]) {
  if (characterIds.length) {
    const count = await prisma.character.count({
      where: { id: { in: characterIds }, gameId }
    })
    if (count !== characterIds.length) {
      throw createError({ statusCode: 400, message: 'Personnages invalides pour ce jeu' })
    }
  }

  if (factionIds.length) {
    const count = await prisma.faction.count({
      where: { id: { in: factionIds }, gameId }
    })
    if (count !== factionIds.length) {
      throw createError({ statusCode: 400, message: 'Groupes invalides pour ce jeu' })
    }
  }

  if (intrigueIds.length) {
    const count = await prisma.intrigue.count({
      where: { id: { in: intrigueIds }, gameId }
    })
    if (count !== intrigueIds.length) {
      throw createError({ statusCode: 400, message: 'Intrigues invalides pour ce jeu' })
    }
  }

  if (itemIds.length) {
    const count = await prisma.item.count({
      where: { id: { in: itemIds }, gameId }
    })
    if (count !== itemIds.length) {
      throw createError({ statusCode: 400, message: 'Objets invalides pour ce jeu' })
    }
  }
}

export function withTimelineConflicts<T extends TimelineEventWithRelations>(events: T[]) {
  const resourcesBySlot = new Map<string, ConflictResource>()

  for (const event of events) {
    for (const character of event.characters || []) {
      addResource(resourcesBySlot, event, 'character', character)
    }

    for (const item of event.items || []) {
      addResource(resourcesBySlot, event, 'item', item)
    }
  }

  const conflictsByEventId = new Map<string, ConflictResource[]>()

  for (const conflict of resourcesBySlot.values()) {
    if (conflict.eventIds.length < 2) continue

    for (const eventId of conflict.eventIds) {
      const current = conflictsByEventId.get(eventId) || []
      current.push(conflict)
      conflictsByEventId.set(eventId, current)
    }
  }

  return events.map((event) => ({
    ...event,
    conflicts: conflictsByEventId.get(event.id) || []
  }))
}

function addResource(
  resourcesBySlot: Map<string, ConflictResource>,
  event: TimelineEventWithRelations,
  type: 'character' | 'item',
  resource: { id: string, name: string }
) {
  const key = `${event.day}:${event.time}:${type}:${resource.id}`
  const current = resourcesBySlot.get(key) || {
    type,
    id: resource.id,
    name: resource.name,
    eventIds: [],
    eventNames: []
  }

  current.eventIds.push(event.id)
  current.eventNames.push(event.name)
  resourcesBySlot.set(key, current)
}
