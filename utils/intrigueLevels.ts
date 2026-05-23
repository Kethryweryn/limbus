export const intrigueLevelLabels: Record<string, string> = {
  main_story: 'Trame principale scénario',
  main_character: 'Trame principale personnage',
  major: 'Intrigue majeure',
  minor: 'Intrigue mineure'
}

export const intrigueLevelOrder: Record<string, number> = {
  main_story: 0,
  main_character: 1,
  major: 2,
  minor: 3
}

export function formatIntrigueLevel(level?: string | null) {
  return intrigueLevelLabels[level || 'minor'] || intrigueLevelLabels.minor
}
