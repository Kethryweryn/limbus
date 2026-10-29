// Session modifiée hors ligne (US-048) : la page affiche aussitôt ce qui est parti en file, avec la forme que
// renverrait le serveur. Les personnes, personnages et lieux sont repris des listes de l'appareil.

type Named = { id: string, name?: string, [key: string]: any }
type Lookup = { characters?: Named[], participants?: Named[], locations?: Named[] }

function byId(...lists: Array<Array<Named | null | undefined> | undefined>) {
  const map = new Map<string, Named>()
  for (const list of lists) {
    for (const item of list || []) {
      if (item?.id) map.set(item.id, item)
    }
  }
  return map
}

// Personne absente des listes de l'appareil : un nom neutre plutôt qu'une page cassée
const unknownParticipant = (id: string) => ({ id, name: 'Participant' })

export function projectOfflineSession(session: any, body: any, lookup: Lookup) {
  const participants = byId(
    lookup.participants,
    session.participants?.map((item: any) => item.participant),
    session.assignments?.map((item: any) => item.participant)
  )
  const characters = byId(lookup.characters, session.assignments?.map((item: any) => item.character))
  const locations = byId(lookup.locations, [session.location])
  const previousAssignments = new Map((session.assignments || []).map((item: any) => [item.characterId, item]))

  return {
    ...session,
    ...(body.name !== undefined && { name: body.name }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.published !== undefined && { published: Boolean(body.published) }),
    ...(body.date !== undefined && { date: body.date ? new Date(body.date).toISOString() : null }),
    ...(body.locationId !== undefined && {
      locationId: body.locationId || null,
      location: body.locationId ? locations.get(body.locationId) || null : null
    }),
    participants: body.participants
      ? body.participants.map((item: any) => ({
          sessionId: session.id,
          participantId: item.participantId,
          role: item.role,
          participant: participants.get(item.participantId) || unknownParticipant(item.participantId)
        }))
      : session.participants,
    assignments: body.assignments
      ? body.assignments.map((item: any) => {
          const previous: any = previousAssignments.get(item.characterId) || {}
          return {
            ...previous,
            sessionId: session.id,
            characterId: item.characterId,
            participantId: item.participantId || null,
            photoUrl: item.photoUrl || null,
            notes: item.notes || null,
            character: characters.get(item.characterId) || previous.character || { id: item.characterId, name: 'Personnage' },
            participant: item.participantId ? participants.get(item.participantId) || unknownParticipant(item.participantId) : null
          }
        })
      : session.assignments,
    __offlinePending: true
  }
}

export function projectOfflineTimeline(timeline: any, assignments: Array<{ timelineEventId: string, participantIds?: string[] }>, lookup: Lookup) {
  const participants = byId(lookup.participants, timeline.session?.participants?.map((item: any) => item.participant))
  const responsibleIds = new Map(assignments.map((assignment) => [assignment.timelineEventId, assignment.participantIds || []]))

  return {
    ...timeline,
    events: (timeline.events || []).map((event: any) => ({
      ...event,
      responsibles: (responsibleIds.get(event.id) || []).map((participantId) => ({
        sessionId: timeline.session?.id,
        timelineEventId: event.id,
        participantId,
        participant: participants.get(participantId) || unknownParticipant(participantId)
      }))
    }))
  }
}
