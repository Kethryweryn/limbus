import { CHARACTER_RELATION_TYPE_VALUES } from '~/utils/characterRelations'
import { REGISTRATION_CHOICE_TYPES, normalizeRegistrationFormDefinition, type RegistrationFormDefinition } from '~/utils/registrationForms'

// Ce qu'un assistant voit d'une inscription (SPEC-014, R8) : jamais le texte libre écrit par la personne, où des
// instructions piégées pourraient se cacher

const CLOSED_TYPES = new Set([...REGISTRATION_CHOICE_TYPES, 'scale'])
const RELATION_TYPES = new Set<string>(CHARACTER_RELATION_TYPE_VALUES)

/** Réponses aux questions fermées (choix, échelle), lues avec la version du formulaire remplie. */
export function closedAnswers(definition: unknown, answers: unknown) {
  if (!definition || !answers || typeof answers !== 'object') return []
  const { questions } = normalizeRegistrationFormDefinition(definition as RegistrationFormDefinition)
  const values = answers as Record<string, unknown>
  return questions
    .filter((question) => CLOSED_TYPES.has(question.type) && values[question.id] !== undefined && values[question.id] !== null && values[question.id] !== '')
    .map((question) => {
      const answer = values[question.id]
      // Une option est une valeur du formulaire de l'équipe : une réponse hors des options n'est pas rendue
      const kept = question.type === 'scale'
        ? (typeof answer === 'number' && answer >= 1 && answer <= 5 ? answer : null)
        : (Array.isArray(answer) ? answer : [answer]).filter((value) => typeof value === 'string' && question.options.includes(value))
      return { questionId: question.id, question: question.label, answer: kept }
    })
    .filter((row) => row.answer !== null && (!Array.isArray(row.answer) || row.answer.length))
}

type AffinityLine = { kind: string, text: string, targetUnknown: boolean, targetParticipant: { id: string, name: string } | null }
type ProcessedAffinity = { kind: string, value?: string, participant?: { id: string, name: string }, noMatchInGame?: true }

/**
 * Affinités traitées par l'équipe : une ligne rattachée devient le lien vers la personne du jeu, une ligne sans
 * correspondance est dite telle, sans son texte ; une relation refusée cochée garde sa valeur fixe. Le reste n'est pas rendu.
 */
export function processedAffinities(lines: AffinityLine[]): ProcessedAffinity[] {
  return lines.flatMap((line): ProcessedAffinity[] => {
    if (line.kind === 'refusedRelationTypes') return RELATION_TYPES.has(line.text) ? [{ kind: line.kind, value: line.text }] : []
    if (line.kind === 'refusedRelations') return []
    if (line.targetParticipant) return [{ kind: line.kind, participant: line.targetParticipant }]
    if (line.targetUnknown) return [{ kind: line.kind, noMatchInGame: true as const }]
    return []
  })
}
