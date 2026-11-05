import { quantile } from './statistics'
import type { RegistrationQuestionType } from './registrationForms'

// Règles de relecture des questions (US-144, SPEC-016, R11, ADR-0062) : un repérage par mots, prévisible mais incomplet

export type DraftingQuestion = { id: string, label: string, type: RegistrationQuestionType, options: string[] }
// Où un mot a été repéré : dans le libellé (option null) ou dans une option
export type DraftingPlace = { word: string, option: string | null }
export type DraftingFlag =
  | { rule: 'doubleBarreled' | 'agreeFormat' | 'vagueQuantifier', places: DraftingPlace[] }
  | { rule: 'doubleNegative', negations: number }
  | { rule: 'length', words: number }
export type DraftingRule = DraftingFlag['rule']

const VAGUE_QUANTIFIERS = new Set([
  'souvent', 'parfois', 'rarement', 'regulierement', 'frequemment', 'beaucoup', 'peu', 'quelquefois', 'occasionnellement',
  'habituellement', 'generalement', 'plusieurs', 'quelques'
])

const withoutAccents = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '')
const hasLetter = (text: string) => /[\p{L}\p{N}]/u.test(text)

/** Nombre de mots : le texte découpé aux espaces et à l'apostrophe, sans la ponctuation isolée (« Prêt ? » fait un mot). */
export const wordCount = (text: string) => text.split(/[\s'’]+/).filter(hasLetter).length

// Les mots à comparer aux listes : une casse et un découpage communs. Ils gardent leurs accents, car « où » n'est pas « ou »
const wordsOf = (text: string) => text.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

// Le libellé puis les options, chacun avec ses mots
const placesOf = (question: DraftingQuestion) => [
  { option: null, words: wordsOf(question.label) },
  ...question.options.map((option) => ({ option, words: wordsOf(option) }))
]

function findPlaces(question: DraftingQuestion, wordsFound: (words: string[]) => string[]) {
  return placesOf(question).flatMap(({ option, words }) => [...new Set(wordsFound(words))].map((word): DraftingPlace => ({ word, option })))
}

const doubleBarreled = (words: string[]) => words.filter((word) => word === 'et' || word === 'ou')

const agreeFormat = (words: string[]) => {
  const plain = words.map(withoutAccents)
  return plain.some((word, index) => word === 'd' && plain[index + 1] === 'accord') ? ['d’accord'] : []
}

// « Peu importe » ne dit aucune quantité
const vagueQuantifiers = (words: string[]) => words.filter((word, index) => {
  const plain = withoutAccents(word)
  return VAGUE_QUANTIFIERS.has(plain) && !(plain === 'peu' && words[index + 1] === 'importe')
})

/** Négations d'un texte : « ne » ou « n' », avec leur « pas » qui ne compte pas en plus, « sans », « non », et « pas » seul si la phrase n'a pas de « ne ». */
export function negationCount(text: string) {
  return text.split(/[.!?;]+/).reduce((total, sentence) => {
    const words = wordsOf(sentence).map(withoutAccents)
    const count = (...kept: string[]) => words.filter((word) => kept.includes(word)).length
    const ne = count('ne', 'n')
    return total + ne + count('sans', 'non') + (ne ? 0 : count('pas'))
  }, 0)
}

/** Valeur au-delà de laquelle une question est trop longue (Tukey) ; sans limite si l'écart interquartile est nul. */
export function lengthLimit(counts: number[]) {
  if (!counts.length) return null
  const sorted = [...counts].sort((left, right) => left - right)
  const low = quantile(sorted, 0.25)
  const high = quantile(sorted, 0.75)
  return high > low ? high + 1.5 * (high - low) : null
}

/** Signalements de chaque question du formulaire, dans son ordre, et le nombre de mots de toutes ses questions. */
export function draftingReview(questions: DraftingQuestion[]) {
  const wordCounts = questions.map((question) => ({ label: question.label, words: wordCount(question.label) }))
  const limit = lengthLimit(wordCounts.map(({ words }) => words))
  const flagged = questions.map((question, index) => {
    const flags: DraftingFlag[] = []
    if (question.type !== 'text') {
      const barreled = findPlaces(question, doubleBarreled)
      if (barreled.length) flags.push({ rule: 'doubleBarreled', places: barreled })
      const negations = negationCount(question.label)
      if (negations >= 2) flags.push({ rule: 'doubleNegative', negations })
      const agree = findPlaces(question, agreeFormat)
      if (agree.length) flags.push({ rule: 'agreeFormat', places: agree })
      const vague = findPlaces(question, vagueQuantifiers)
      if (vague.length) flags.push({ rule: 'vagueQuantifier', places: vague })
    }
    const words = wordCounts[index]!.words
    if (limit !== null && words > limit) flags.push({ rule: 'length', words })
    return { questionId: question.id, label: question.label, flags }
  })
  return { questions: flagged.filter(({ flags }) => flags.length), wordCounts }
}

export type DraftingReview = ReturnType<typeof draftingReview>
