import type { z } from 'zod'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { sessionSchema, sessionTimelineSchema } from '~/server/utils/schemas'
import { sessionDayLabel } from '~/utils/sessionLabels'

// Session modifiée hors ligne (US-048) : la page affiche aussitôt ce qui est parti en file, avec la forme que
// renverrait le serveur. Les personnes, personnages et lieux sont repris des listes de l'appareil. Typée par la route
// et par le schéma d'enregistrement : une réponse ou un corps qui change fait échouer la vérification ici.

type SessionDetail = ApiResponse<'/api/sessions/:id'>
type SessionTimeline = ApiResponse<'/api/sessions/:id/timeline'>
// Ce que lit la projection : une session lue, ou déjà projetée par une modification précédente hors ligne
type SessionLike = Pick<SessionDetail, 'id'> & {
  date?: string | Date | null
  location?: Named | null
  participants?: Array<{ participant?: Named | null }>
  assignments?: Array<{ characterId: string, character?: Named | null, participant?: Named | null, locked?: boolean, reservedRegistrationId?: string | null }>
}
type TimelineLike = Omit<SessionTimeline, 'session' | 'events'> & {
  session?: { id: string, participants?: Array<{ participant?: Named | null }> } | null
  events?: Array<SessionTimeline['events'][number]>
}
// Corps envoyé par la page : celui du schéma d'enregistrement, avec l'équipe et le cast tels que le formulaire les tient
type SessionBody = Omit<Partial<z.input<typeof sessionSchema>>, 'status' | 'participants' | 'assignments'> & {
  status?: string
  participants?: Array<{ participantId?: string | null, role: string, participant?: { id: string } | null }>
  assignments?: Array<{ characterId?: string, participantId?: string | null, photoUrl?: string | null, notes?: string | null, locked?: boolean, reservedRegistrationId?: string | null }>
}
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

const dateChanged = (before: string | Date | null | undefined, after: string | null | undefined) =>
  (before ? new Date(before).getTime() : null) !== (after ? new Date(after).getTime() : null)

export function projectOfflineSession<S extends SessionLike>(session: S, body: SessionBody, lookup: Lookup) {
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
    // Le libellé suit une date changée (SPEC-021) ; ce qui le distingue d'une voisine du même jour attend le serveur
    ...(body.date !== undefined && dateChanged(session.date, body.date) && { label: sessionDayLabel(body.date) }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.published !== undefined && { published: Boolean(body.published) }),
    ...(body.date !== undefined && { date: body.date ? new Date(body.date).toISOString() : null }),
    ...(body.locationId !== undefined && {
      locationId: body.locationId || null,
      location: body.locationId ? locations.get(body.locationId) || null : null
    }),
    participants: body.participants
      ? body.participants.map((item) => {
          const participantId = item.participantId || item.participant?.id || ''
          return {
            sessionId: session.id,
            participantId,
            role: item.role,
            participant: participants.get(participantId) || unknownParticipant(participantId)
          }
        })
      : session.participants,
    assignments: body.assignments
      ? body.assignments.filter((item) => item.characterId).map((item) => {
          const characterId = item.characterId!
          const previous = previousAssignments.get(characterId)
          return {
            ...previous,
            sessionId: session.id,
            characterId,
            participantId: item.participantId || null,
            photoUrl: item.photoUrl || null,
            notes: item.notes || null,
            // Absents du corps : la ligne garde son cadenas et sa réservation (ADR-0051)
            locked: item.locked ?? previous?.locked ?? false,
            reservedRegistrationId: item.participantId ? null : item.reservedRegistrationId === undefined ? previous?.reservedRegistrationId ?? null : item.reservedRegistrationId || null,
            character: characters.get(characterId) || previous?.character || { id: characterId, name: 'Personnage' },
            participant: item.participantId ? participants.get(item.participantId) || unknownParticipant(item.participantId) : null
          }
        })
      : session.assignments,
    __offlinePending: true as const
  }
}

export function projectOfflineTimeline<T extends TimelineLike>(timeline: T, assignments: TimelineAssignments, lookup: Lookup) {
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
