export const timelineEventInclude = {
  game: true,
  // Liens par les tables qui portent le jeu (US-191) : la lecture passe par unlinked
  characterLinks: {
    select: { character: { include: { factionLinks: { select: { faction: true }, orderBy: { faction: { name: 'asc' as const } } } } } },
    orderBy: [{ character: { type: 'asc' as const } }, { character: { name: 'asc' as const } }]
  },
  factionLinks: { select: { faction: true }, orderBy: { faction: { name: 'asc' as const } } },
  intrigueLinks: { select: { intrigue: true }, orderBy: { intrigue: { name: 'asc' as const } } },
  itemLinks: { select: { item: true }, orderBy: { item: { name: 'asc' as const } } }
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
