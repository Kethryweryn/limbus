import { Prisma } from '../../generated/prisma/client'
import { gameCharacters } from '~/server/utils/castingAssistant'
import { prisma } from '~/server/utils/prisma'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { currentQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { latestAnswersPerPerson, questionnaireFindings } from '~/utils/questionnaireQuality'

// Repères sur le questionnaire de casting d'un jeu (SPEC-015, US-133, US-136 à US-139) : calculés à la lecture, rien n'est écrit

export async function questionnaireQuality(gameId: string) {
  const [{ definition }, links, characters, registrations] = await Promise.all([
    getCurrentRegistrationForm(gameId),
    currentQuestionLinks(gameId),
    // Les personnages que répartit l'assistant de casting
    gameCharacters(gameId),
    prisma.registration.findMany({
      where: { period: { gameId }, questionAnswers: { not: Prisma.DbNull } },
      select: { participantId: true, questionAnswers: true },
      orderBy: { createdAt: 'desc' }
    })
  ])
  return {
    characterCount: characters.length,
    questionCount: definition.questions.filter((question) => question.type !== 'text').length,
    ...questionnaireFindings(definition.questions, links, characters, latestAnswersPerPerson(registrations))
  }
}
