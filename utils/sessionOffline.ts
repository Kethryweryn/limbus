import type { z } from 'zod'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { sessionSchema, sessionTimelineSchema } from '~/server/utils/schemas'

// Session modifiée hors ligne (US-048) : la page affiche aussitôt ce qui est parti en file, avec la forme que
// renverrait le serveur. Les personnes, personnages et lieux sont repris des listes de l'appareil. Typée par la route
// et par le schéma d'enregistrement : une réponse ou un corps qui change fait échouer la vérification ici.

type SessionDetail = ApiResponse<'/api/sessions/:id'>
type SessionTimeline = ApiResponse<'/api/sessions/:id/timeline'>
type SessionBody = Partial<z.input<typeof sessionSchema>>
type TimelineAssignments = NonNullable<z.input<typeof sessionTimelineSchema>['assignments']>

type Named = { id: string, name: string }
type Lookup = { characters?: Named[], participants?: Named[], locations?: Named[] }

function byId<T extends Named>(...lists: Array<Array<T | null | undefined> | undefined>) {
  const map = new Map<string, T>()
  for (const list of lists) {
    for (const item of list || []) {
      if (item?.id) map.set(item.id, item)
    }
  }
  return map
}

// Personne absente des listes de l'appareil : un nom neutre plutôt qu'une page cassée
const unknownParticipant = (id: string): Named => ({ id, name: 'Participant' })

export function projectOfflineSession(session: SessionDetail, body: SessionBody, lookup: Lookup) {
  const participants = byId<Named>(
    lookup.participants,
    session.participants?.map((item) => item.participant),
    session.assignments?.map((item) => item.participant)
  )
  const characters = byId<Named>(lookup.characters, session.assignments?.map((item) => item.character))
  const locations = byId<Named>(lookup.locations, [session.location])
  const previousAssignments = new Map((session.assignments || []).map((item) => [item.characterId, item]))

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
      ? body.participants.map((item) => ({
          sessionId: session.id,
          participantId: item.participantId,
          role: item.role,
          participant: participants.get(item.participantId) || unknownParticipant(item.participantId)
        }))
      : session.participants,
    assignments: body.assignments
      ? body.assignments.map((item) => {
          const previous = previousAssignments.get(item.characterId)
          return {
            ...previous,
            sessionId: session.id,
            characterId: item.characterId,
            participantId: item.participantId || null,
            photoUrl: item.photoUrl || null,
            notes: item.notes || null,
            // Absents du corps : la ligne garde son cadenas et sa réservation (ADR-0051)
            locked: item.locked ?? previous?.locked ?? false,
            reservedRegistrationId: item.participantId ? null : item.reservedRegistrationId === undefined ? previous?.reservedRegistrationId ?? null : item.reservedRegistrationId || null,
            character: characters.get(item.characterId) || previous?.character || { id: item.characterId, name: 'Personnage' },
            participant: item.participantId ? participants.get(item.participantId) || unknownParticipant(item.participantId) : null
          }
        })
      : session.assignments,
    __offlinePending: true as const
  }
}

export function projectOfflineTimeline(timeline: SessionTimeline, assignments: TimelineAssignments, lookup: Lookup) {
  const participants = byId<Named>(lookup.participants, timeline.session?.participants?.map((item) => item.participant))
  const responsibleIds = new Map(assignments.map((assignment) => [assignment.timelineEventId, assignment.participantIds || []]))

  return {
    ...timeline,
    events: (timeline.events || []).map((event) => ({
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
