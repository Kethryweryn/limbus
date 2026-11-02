import type { ApiResponse } from '~/composables/useApiFetch'

// Timeline d'un jeu (US-115) : ce que partagent sa page et ses sous-composants

export type TimelineEventRow = ApiResponse<'/api/timeline-events'>[number]
export type TimelineGame = ApiResponse<'/api/games'>[number]

/** Titre de l'alerte d'un événement en conflit : les personnages et objets pris au même créneau. */
export function conflictTitle(timelineEvent: { conflicts: Array<{ type: string, name: string }> }) {
  const labels = timelineEvent.conflicts
    .map((conflict) => `${conflict.type === 'character' ? 'Personnage' : 'Objet'} : ${conflict.name}`)
    .join(', ')
  return `Conflit au même créneau (${labels})`
}
