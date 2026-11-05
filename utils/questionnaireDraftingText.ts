import type { DraftingFlag, DraftingPlace, DraftingReview, DraftingRule } from './questionnaireDrafting'

// Phrases de la partie « Rédaction » (US-144, SPEC-016, R11) : la règle, ce qu'il faut vérifier, et en détail la référence

const RULE_TEXTS: Record<DraftingRule, { todo: string, reference: string }> = {
  doubleBarreled: {
    todo: 'Vérifiez qu’elle ne porte que sur une chose à la fois ; sinon, scindez-la.',
    reference: 'Bradburn, Sudman et Wansink (2004), Asking Questions.'
  },
  doubleNegative: {
    todo: 'Reformulez-la avec une seule négation, ou aucune.',
    reference: 'Artino et al. (2014), AMEE Guide No. 87.'
  },
  agreeFormat: {
    todo: 'Ce format pousse à acquiescer : mieux vaut des options propres à la question (« très souvent… jamais »).',
    reference: 'Saris, Revilla, Krosnick et Shaeffer (2010), Survey Research Methods.'
  },
  vagueQuantifier: {
    todo: 'Chacun le comprend à sa façon : préférez une fréquence ou une quantité précise quand elle compte.',
    reference: 'Bradburn et Miles (1979) ; Schaeffer (1991). Leur intérêt est discuté pour comparer des personnes (Al Baghal, 2014).'
  },
  length: {
    todo: 'Raccourcissez-la si vous le pouvez : une question plus longue est en général moins fiable.',
    reference: 'Tukey (1977) pour la règle (au-delà du troisième quartile plus une fois et demie l’écart interquartile) ; Alwin et Beattie (2016).'
  }
}

const placeText = ({ word, option }: DraftingPlace) => `« ${word} » ${option === null ? 'dans le libellé' : `dans l’option « ${option} »`}`
const placesText = (places: DraftingPlace[]) => places.map(placeText).join(', ')

function flagSentence(flag: DraftingFlag) {
  switch (flag.rule) {
    case 'doubleBarreled': return `Question à double sens possible : ${placesText(flag.places)}.`
    case 'doubleNegative': return `Double négation : ${flag.negations} négations dans le libellé.`
    case 'agreeFormat': return `Format « d’accord / pas d’accord » : ${placesText(flag.places)}.`
    case 'vagueQuantifier': return `Quantifieur vague : ${placesText(flag.places)}.`
    case 'length': return `Question nettement plus longue que les autres : ${flag.words} mots.`
  }
}

const wordsText = (count: number) => `${count} mot${count > 1 ? 's' : ''}`

export function describeDraftingFlag(flag: DraftingFlag, wordCounts: DraftingReview['wordCounts']) {
  const { todo, reference } = RULE_TEXTS[flag.rule]
  const counts = flag.rule === 'length'
    ? ` Nombre de mots de chaque question : ${wordCounts.map(({ label, words }) => `« ${label} » : ${wordsText(words)}`).join(' ; ')}.`
    : ''
  return { level: 'watch' as const, sentence: flagSentence(flag), todo, detail: `${reference}${counts}` }
}

/** Nombre de signalements, pour le titre de la partie. */
export const draftingFlagCount = (review: DraftingReview) => review.questions.reduce((total, { flags }) => total + flags.length, 0)
