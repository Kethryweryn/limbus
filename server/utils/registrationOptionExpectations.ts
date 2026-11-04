import { prisma } from '~/server/utils/prisma'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { optionsOf } from '~/utils/questionnaireQuality'
import { REGISTRATION_CHOICE_TYPES, type RegistrationQuestion } from '~/utils/registrationForms'

// Proportions attendues des options du questionnaire (US-141, SPEC-016, R6, ADR-0062) : hors des versions du formulaire

type ExpectationInput = { questionId: string, option: string, share: number }

const accepts = (question: RegistrationQuestion | undefined, option: string) =>
  Boolean(question && (question.type === 'scale' || REGISTRATION_CHOICE_TYPES.includes(question.type)) && optionsOf(question).includes(option))

/** Proportions qui visent une question et une option du formulaire en vigueur ; les autres sont ignorées. */
export async function optionExpectationsOf(gameId: string, questions: RegistrationQuestion[]) {
  const rows = await prisma.registrationOptionExpectation.findMany({ where: { gameId }, select: { questionId: true, option: true, share: true } })
  const byId = new Map(questions.map((question) => [question.id, question]))
  return rows.filter((row) => accepts(byId.get(row.questionId), row.option))
}

/** Version lue par l'éditeur : le plus récent `updatedAt` des lignes, null s'il n'y en a aucune. */
export async function optionExpectationsVersion(gameId: string) {
  const { _max } = await prisma.registrationOptionExpectation.aggregate({ where: { gameId }, _max: { updatedAt: true } })
  return _max.updatedAt
}

// Ce que lit l'éditeur : les proportions et leur version
async function expectationsState(gameId: string, questions: RegistrationQuestion[]) {
  const [expectations, version] = await Promise.all([optionExpectationsOf(gameId, questions), optionExpectationsVersion(gameId)])
  return { expectations, version: version?.toISOString() ?? null }
}

export async function optionExpectationsState(gameId: string) {
  const { definition } = await getCurrentRegistrationForm(gameId)
  return await expectationsState(gameId, definition.questions)
}

/** Remplace les proportions du jeu. Pour un choix unique ou une échelle, au moins une part doit être positive. */
export async function saveOptionExpectations(gameId: string, expectations: ExpectationInput[]) {
  const { definition } = await getCurrentRegistrationForm(gameId)
  const questions = new Map(definition.questions.map((question) => [question.id, question]))
  for (const { questionId, option } of expectations) {
    if (!accepts(questions.get(questionId), option)) throw createError({ statusCode: 400, message: 'Une proportion vise une question ou une option qui n’existe plus : rechargez le formulaire.' })
  }
  for (const [questionId, rows] of Map.groupBy(expectations, (row) => row.questionId)) {
    if (questions.get(questionId)!.type !== 'multiple' && rows.every((row) => !row.share)) {
      throw createError({ statusCode: 400, message: 'Au moins une part doit être positive pour une question à choix unique ou une échelle.' })
    }
  }

  // Une même option envoyée deux fois n'est gardée qu'une fois
  const unique = new Map(expectations.map((row) => [`${row.questionId}\u0000${row.option}`, { gameId, ...row }]))
  await prisma.$transaction([
    prisma.registrationOptionExpectation.deleteMany({ where: { gameId } }),
    prisma.registrationOptionExpectation.createMany({ data: [...unique.values()] })
  ])
  return await expectationsState(gameId, definition.questions)
}
