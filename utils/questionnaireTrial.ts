// Essai du questionnaire par l'équipe (US-135, SPEC-016, R2) : classement des personnages pour des réponses données, rien n'est enregistré
import { castingScore, type CastingLink, type CastingQuestion } from './castingAssistant'
import type { QualityCharacter } from './questionnaireQuality'

/** Personnages rejoints par au moins une réponse, de la meilleure note à la moins bonne, et personnages qu'aucune ne rejoint. */
export function trialRanking(characters: QualityCharacter[], questions: CastingQuestion[], links: CastingLink[], answers: Record<string, unknown>) {
  const player = { id: '', name: '', answers, refusedTypes: [], notWithIds: [] }
  const scored = characters.map((character) => ({
    id: character.id,
    name: character.name,
    ...castingScore(player, { ...character, relations: [] }, questions, links)
  }))
  const reached = scored.filter(({ score }) => score > 0)
  const sameScore = Map.groupBy(reached, ({ score }) => score)
  return {
    ranked: [...reached].sort((a, b) => b.score - a.score).map((entry) => ({ ...entry, tied: sameScore.get(entry.score)!.length > 1 })),
    unreached: scored.filter(({ score }) => score === 0).map(({ id, name }) => ({ id, name }))
  }
}
