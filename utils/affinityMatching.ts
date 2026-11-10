// Suggestions de rattachement d'une affinité (US-095, ADR-0049) : personnes du jeu au nom proche du texte saisi.
// Rien n'est rattaché sans l'équipe, même pour un nom identique.

// Sortes d'affinité qui désignent une personne ; « les relations que je ne veux pas jouer » reste du texte
export const PERSON_AFFINITY_KINDS = ['wantWith', 'notWith', 'avoid'] as const
// Sortes qui font apparaître une alerte quand les deux personnes sont dans la même session (R25)
export const ALERT_AFFINITY_KINDS = ['avoid', 'notWith'] as const

export const isPersonAffinityKind = (kind: string) => (PERSON_AFFINITY_KINDS as readonly string[]).includes(kind)

export const AFFINITY_SUGGESTION_LIMIT = 3
const SUGGESTION_THRESHOLD = 0.6

// Sans accents, ligatures, casse ni ponctuation, espaces réduits
export function normalizeName(value: string) {
  return value
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function editDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    const current = [i]
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[right.length]!
}

/**
 * Chaque mot du nom le plus court se retrouve dans un mot distinct de l'autre : 1 pour un mot identique, 0,8 pour une
 * initiale (« D » de « Durand »), 0,6 pour un début de mot (« Max » de « Maxence »). Renvoie la moyenne, 0 si un mot
 * manque : « Paul D. » est plus proche de « Paul Durand » que de « Paula Dupont ».
 */
function wordsScore(shorter: string[], longer: string[]) {
  const free = [...longer]
  let total = 0
  for (const word of shorter) {
    const scores: number[] = free.map((candidate) => candidate === word ? 1 : !candidate.startsWith(word) ? 0 : word.length === 1 ? 0.8 : 0.6)
    const best = Math.max(0, ...scores)
    if (!best) return 0
    total += best
    free.splice(scores.indexOf(best), 1)
  }
  return total / shorter.length
}

/** Proximité de deux noms entre 0 et 1 : 1 pour un nom identique, puis le recouvrement des mots ou la distance d'édition, le meilleur des deux. */
export function nameSimilarity(written: string, name: string) {
  const left = normalizeName(written)
  const right = normalizeName(name)
  if (!left || !right) return 0
  if (left === right) return 1
  const leftWords = left.split(' ')
  const rightWords = right.split(' ')
  const [shorter, longer] = leftWords.length <= rightWords.length ? [leftWords, rightWords] : [rightWords, leftWords]
  // Un nom identique reste seul au sommet
  const words = Math.min(0.95, wordsScore(shorter, longer))
  return Math.max(words, 1 - editDistance(left, right) / Math.max(left.length, right.length))
}

/** Les personnes au nom le plus proche du texte saisi, au-dessus du seuil, la plus proche en premier. */
export function suggestPeople<T extends { id: string, name: string }>(written: string, people: T[], limit = AFFINITY_SUGGESTION_LIMIT) {
  return people
    .map((person) => ({ person, score: nameSimilarity(written, person.name) }))
    .filter(({ score }) => score >= SUGGESTION_THRESHOLD)
    .sort((left, right) => right.score - left.score || left.person.name.localeCompare(right.person.name))
    .slice(0, limit)
    .map(({ person }) => person)
}

// Clé d'une ligne pour reprendre son rattachement à une nouvelle réponse : même sorte, même texte
export const affinityLineKey = (kind: string, text: string) => `${kind}\u0000${text.trim().toLowerCase()}`
