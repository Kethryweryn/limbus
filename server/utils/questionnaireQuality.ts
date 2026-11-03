import { gameCharacters } from '~/server/utils/castingAssistant'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { currentQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { linkFindings } from '~/utils/questionnaireQuality'

// Repères sur le questionnaire de casting d'un jeu (SPEC-015, US-133) : calculés à la lecture, rien n'est écrit

export async function questionnaireQuality(gameId: string) {
  const [{ definition }, links, characters] = await Promise.all([
    getCurrentRegistrationForm(gameId),
    currentQuestionLinks(gameId),
    // Les personnages que répartit l'assistant de casting
    gameCharacters(gameId)
  ])
  return {
    characterCount: characters.length,
    questionCount: definition.questions.filter((question) => question.type !== 'text').length,
    findings: linkFindings(definition.questions, links, characters)
  }
}
