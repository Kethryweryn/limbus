import { prisma } from '~/server/utils/prisma'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { currentQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { CHARACTER_TYPES } from '~/utils/domain'
import { linkFindings } from '~/utils/questionnaireQuality'

// Repères sur le questionnaire de casting d'un jeu (SPEC-015, US-133) : calculés à la lecture, rien n'est écrit

const nameSelect = { select: { id: true, name: true } } as const

export async function questionnaireQuality(gameId: string) {
  const [{ definition }, links, characters] = await Promise.all([
    getCurrentRegistrationForm(gameId),
    currentQuestionLinks(gameId),
    prisma.character.findMany({
      where: { gameId, type: CHARACTER_TYPES.pj },
      select: { id: true, name: true, factions: nameSelect, intrigues: nameSelect },
      orderBy: { name: 'asc' }
    })
  ])
  return {
    characterCount: characters.length,
    questionCount: definition.questions.filter((question) => question.type !== 'text').length,
    findings: linkFindings(definition.questions, links, characters)
  }
}
