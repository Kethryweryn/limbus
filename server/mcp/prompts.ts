import * as z from 'zod'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { draftingReview, type DraftingQuestion } from '~/utils/questionnaireDrafting'
import { describeDraftingFlag } from '~/utils/questionnaireDraftingText'
import { safeErrorMessage, type ToolContext } from '~/server/mcp/tools'

// Consigne « Relire le questionnaire » (US-145, SPEC-016, R12, ADR-0062) : le formulaire de l'équipe et ses signalements, jamais
// une réponse ni une donnée de participant. L'assistant répond dans la conversation : rien n'est écrit, rien n'est noté au journal

const QUESTION_TYPES: Record<DraftingQuestion['type'], string> = {
  text: 'texte libre',
  single: 'choix unique',
  multiple: 'choix multiples',
  scale: 'échelle de 1 à 5'
}

// Les règles étayées de l'état de l'art (fiche d'origine de SPEC-016), dont celles qu'une règle de mots ne repère pas
const REVIEW_RULES = [
  'Question à double sens : elle porte sur deux choses à la fois (Bradburn, Sudman et Wansink, 2004).',
  'Double négation : à éviter (Artino et al., 2014).',
  'Format « d’accord / pas d’accord » : il pousse à acquiescer ; préférer des options propres à la question (Saris, Revilla, Krosnick et Shaeffer, 2010).',
  'Quantifieur vague : « souvent », « parfois »… chacun le comprend à sa façon (Bradburn et Miles, 1979 ; Schaeffer, 1991).',
  'Question longue : en général moins fiable (Alwin et Beattie, 2016).',
  'Question orientée : sa formulation pousse vers une réponse (Bradburn, Sudman et Wansink, 2004).',
  'Présupposé : elle tient pour acquis ce qui n’est pas vrai de tout le monde (Willis et Lessler, 1999, QAS-99 ; Graesser et al., 2006).',
  'Options qui se chevauchent, ou qui ne couvrent pas tous les cas (Willis et Lessler, 1999, QAS-99).',
  'Terme technique ou peu connu des personnes qui répondent (Graesser et al., 2006).'
]

/** Message de la consigne : les questions propres au jeu, les signalements des règles de Limbus, les règles et la demande. */
export function questionnaireReviewPrompt(questions: DraftingQuestion[]) {
  if (!questions.length) return 'Le formulaire d’inscription de ce jeu n’a aucune question propre au jeu : dites-le à l’organisatrice, il n’y a rien à relire.'
  const review = draftingReview(questions)
  const lines = questions.map((question, index) => {
    const options = question.options.map((option) => `   - ${option}`)
    const flags = review.questions.find(({ questionId }) => questionId === question.id)?.flags ?? []
    const flagged = flags.map((flag) => `   Signalé par Limbus : ${describeDraftingFlag(flag, review.wordCounts).sentence}`)
    return [`${index + 1}. ${question.label} (${QUESTION_TYPES[question.type]})`, ...options, ...flagged].join('\n')
  })
  return [
    'Relisez le questionnaire d’inscription de ce jeu de rôle grandeur nature. Il sert à répartir les rôles : chaque réponse rapproche la personne de certains personnages.',
    `Questions :\n${lines.join('\n')}`,
    `Règles à appliquer :\n${REVIEW_RULES.map((rule) => `- ${rule}`).join('\n')}`,
    'Les signalements de Limbus viennent de règles de mots, qui se trompent parfois : vérifiez-les, et cherchez aussi ce qu’elles ne voient pas.',
    'Pour chaque question qui a un défaut, donnez le défaut, la règle et une réécriture proposée. Dites aussi quelles questions n’appellent aucune remarque. Répondez dans la conversation, sans rien modifier dans Limbus : l’équipe décide.'
  ].join('\n\n')
}

export function registerPrompts({ event, server }: ToolContext) {
  server.registerPrompt('relire_questionnaire', {
    title: 'Relire le questionnaire',
    description: 'Relit la rédaction des questions du formulaire d’inscription d’un jeu autorisé : défaut, règle et réécriture proposée, question par question.',
    argsSchema: z.object({ jeuId: z.string().describe('Identifiant du jeu, donné par lister_jeux') })
  }, async ({ jeuId }) => {
    try {
      await requireGameAccess(event, jeuId)
      const { definition } = await getCurrentRegistrationForm(jeuId)
      return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: questionnaireReviewPrompt(definition.questions) } }] }
    } catch (error) {
      throw new Error(safeErrorMessage(error), { cause: error })
    }
  })
}
