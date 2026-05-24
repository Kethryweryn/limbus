import { INTRIGUE_LEVELS } from '~/utils/domain'

export const intrigueLevelLabels: Record<string, string> = {
  [INTRIGUE_LEVELS.mainStory]: 'Trame principale scénario',
  [INTRIGUE_LEVELS.mainCharacter]: 'Trame principale personnage',
  [INTRIGUE_LEVELS.major]: 'Intrigue majeure',
  [INTRIGUE_LEVELS.minor]: 'Intrigue mineure'
}

export const intrigueLevelOrder: Record<string, number> = {
  [INTRIGUE_LEVELS.mainStory]: 0,
  [INTRIGUE_LEVELS.mainCharacter]: 1,
  [INTRIGUE_LEVELS.major]: 2,
  [INTRIGUE_LEVELS.minor]: 3
}

export function formatIntrigueLevel(level?: string | null) {
  return intrigueLevelLabels[level || INTRIGUE_LEVELS.minor] || intrigueLevelLabels[INTRIGUE_LEVELS.minor]
}
