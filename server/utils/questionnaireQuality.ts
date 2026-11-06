import { Prisma } from '../../generated/prisma/client'
import { gameCharacters } from '~/server/utils/castingAssistant'
import { prisma } from '~/server/utils/prisma'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { optionExpectationsOf } from '~/server/utils/registrationOptionExpectations'
import { questionLinksOf } from '~/server/utils/registrationQuestionLinks'
import { draftingReview } from '~/utils/questionnaireDrafting'
import { peopleWithAnswers, questionnaireFindings } from '~/utils/questionnaireQuality'

// Repères sur le questionnaire de casting d'un jeu (SPEC-015, US-133, US-136 à US-139) : calculés à la lecture, rien n'est écrit.
// Rend aussi les personnages PJ, pour l'essai du questionnaire (SPEC-016, US-135), et le reste de ce que la prévision calcule
// dans le navigateur (US-142, US-143), et les signalements de rédaction (US-144)

export async function questionnaireQuality(gameId: string) {
  const { definition } = await getCurrentRegistrationForm(gameId)
  const [links, expectations, characters, registrations] = await Promise.all([
    questionLinksOf(gameId, definition.questions),
    optionExpectationsOf(gameId, definition.questions),
    // Les personnages que répartit l'assistant de casting
    gameCharacters(gameId),
    prisma.registration.findMany({
      where: { period: { gameId }, questionAnswers: { not: Prisma.DbNull } },
      select: { questionAnswers: true }
    })
  ])
  const people = peopleWithAnswers(registrations)
  return {
    // Une réponse, même à une question sans lien, ouvre le temps des repères : la prévision et la relecture se replient (US-142, US-144)
    hasAnswers: people.length > 0,
    characterCount: characters.length,
    characters: characters.map(({ id, name, factions, intrigues }) => ({ id, name, factions, intrigues })),
    questionCount: definition.questions.filter((question) => question.type !== 'text').length,
    forecastInput: { questions: definition.questions, links, expectations },
    drafting: draftingReview(definition.questions),
    ...questionnaireFindings(definition.questions, links, characters, people)
  }
}
