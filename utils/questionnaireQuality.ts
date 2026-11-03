// Qualité du questionnaire de casting (SPEC-015, ADR-0061) : repères calculés à partir du formulaire et des liens.
// Fonctions pures, partagées entre la route et les tests ; les phrases sont rédigées par l'interface.
import { castingScore, type CastingCharacter, type CastingLink, type CastingQuestion } from './castingAssistant'
import { REGISTRATION_CHOICE_TYPES, type RegistrationQuestionType } from './registrationForms'

export type QualityLevel = 'good' | 'watch' | 'review' | 'unsure'
export type QualityQuestion = CastingQuestion & { type: RegistrationQuestionType, options: string[] }
export type QualityCharacter = Pick<CastingCharacter, 'id' | 'name' | 'factions' | 'intrigues'>

// Seuils des repères (ADR-0061) : en changer un est un changement de comportement, qui passe par la spec
export const QUESTIONNAIRE_THRESHOLDS = {
  // R6 : similarité cosinus à partir de laquelle deux personnages sont indistincts (« 8 points sur 10 en commun »)
  indistinctSimilarity: 0.8
} as const

type Named = { id: string, name: string }
type QuestionRef = { questionId: string, questionLabel: string }

export type QuestionnaireFinding =
  | { kind: 'characterWithoutLink', level: 'review', character: Named }
  | { kind: 'questionWithoutLink', level: 'watch' } & QuestionRef
  | { kind: 'optionWithoutLink', level: 'watch', option: string } & QuestionRef
  | {
    kind: 'indistinctCharacters'
    level: 'review'
    characters: [Named, Named]
    similarity: number
    threshold: number
    // Réponse qui sépare le plus les deux personnages, et celui qu'elle favorise ; null si aucune ne les sépare
    separating: { questionLabel: string, option: string, favors: Named } | null
  }

const LEVEL_ORDER: Record<QualityLevel, number> = { review: 0, unsure: 1, watch: 2, good: 3 }

// Une réponse possible : une option d'une question à choix, ou une échelle (option vide) comptée à 5/5
type PossibleAnswer = { question: QualityQuestion, option: string, answer: string | string[] | number }

function possibleAnswers(questions: QualityQuestion[]): PossibleAnswer[] {
  return questions.flatMap((question): PossibleAnswer[] => {
    if (question.type === 'scale') return [{ question, option: '', answer: 5 }]
    if (!REGISTRATION_CHOICE_TYPES.includes(question.type)) return []
    return question.options.map((option) => ({ question, option, answer: question.type === 'multiple' ? [option] : option }))
  })
}

/** Profil de points d'un personnage (R6) : les points que lui donne chaque réponse possible, comme la note de l'assistant. */
export function pointProfile(character: QualityCharacter, questions: QualityQuestion[], links: CastingLink[]) {
  const casting = { ...character, relations: [] }
  const linksOf = Map.groupBy(links, (link) => link.questionId)
  return possibleAnswers(questions).map(({ question, answer }) => castingScore(
    { id: '', name: '', answers: { [question.id]: answer }, refusedTypes: [], notWithIds: [] },
    casting,
    [question],
    linksOf.get(question.id) ?? []
  ).score)
}

/** Similarité cosinus de deux profils de points ; 0 si l'un est nul. */
export function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0
  let normA = 0
  let normB = 0
  a.forEach((value, index) => {
    const other = b[index] ?? 0
    dot += value * other
    normA += value * value
    normB += other * other
  })
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0
}

/** Repères sur les liens, avant les inscriptions (SPEC-015, R4 à R6), du plus grave au moins grave. */
export function linkFindings(questions: QualityQuestion[], links: CastingLink[], characters: QualityCharacter[]): QuestionnaireFinding[] {
  const findings: QuestionnaireFinding[] = []
  const answers = possibleAnswers(questions)
  const linkedQuestions = new Set(links.map((link) => link.questionId))
  const linkedOptions = new Set(links.map((link) => `${link.questionId}\u0000${link.option}`))

  // R5 : question à choix ou échelle sans lien ; option sans lien d'une question reliée par ailleurs
  for (const question of questions) {
    if (question.type !== 'scale' && !REGISTRATION_CHOICE_TYPES.includes(question.type)) continue
    const ref = { questionId: question.id, questionLabel: question.label }
    if (!linkedQuestions.has(question.id)) {
      findings.push({ kind: 'questionWithoutLink', level: 'watch', ...ref })
      continue
    }
    for (const option of question.type === 'scale' ? [] : question.options) {
      if (!linkedOptions.has(`${question.id}\u0000${option}`)) findings.push({ kind: 'optionWithoutLink', level: 'watch', option, ...ref })
    }
  }

  // R4 : personnage qu'aucune réponse ne rejoint ; R6 : paires de personnages reliés aux profils trop proches
  const profiles = characters.map((character) => ({ character, profile: pointProfile(character, questions, links) }))
  const reached = profiles.filter(({ character, profile }) => {
    if (profile.some((points) => points > 0)) return true
    findings.push({ kind: 'characterWithoutLink', level: 'review', character: { id: character.id, name: character.name } })
    return false
  })
  const threshold = QUESTIONNAIRE_THRESHOLDS.indistinctSimilarity
  reached.forEach((first, index) => {
    for (const second of reached.slice(index + 1)) {
      const similarity = cosineSimilarity(first.profile, second.profile)
      if (similarity < threshold) continue
      // Réponse dont l'écart de points entre les deux est le plus grand
      let widest = { index: -1, gap: 0 }
      for (const [index, points] of first.profile.entries()) {
        const gap = points - (second.profile[index] ?? 0)
        if (Math.abs(gap) > Math.abs(widest.gap)) widest = { index, gap }
      }
      const answer = answers[widest.index]
      const favors = widest.gap > 0 ? first.character : second.character
      const separating = answer ? { questionLabel: answer.question.label, option: answer.option, favors: { id: favors.id, name: favors.name } } : null
      findings.push({
        kind: 'indistinctCharacters',
        level: 'review',
        characters: [{ id: first.character.id, name: first.character.name }, { id: second.character.id, name: second.character.name }],
        similarity,
        threshold,
        separating
      })
    }
  })

  return findings.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
}
