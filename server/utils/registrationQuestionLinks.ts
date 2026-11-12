import type { Prisma } from '~/generated/prisma/client'
import { isUniqueConflict, prisma } from '~/server/utils/prisma'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { REGISTRATION_CHOICE_TYPES, type RegistrationQuestion } from '~/utils/registrationForms'

// Liens du questionnaire vers les personnages, factions et intrigues (US-098, ADR-0050)

const targetSelect = { select: { id: true, name: true } } as const
const linkSelect = { questionId: true, option: true, character: targetSelect, faction: targetSelect, intrigue: targetSelect } as const satisfies Prisma.RegistrationQuestionLinkSelect

type LinkInput = { questionId: string, option: string, characterId?: string | null, factionId?: string | null, intrigueId?: string | null }

// Ce qu'on peut relier : les personnages, factions et intrigues du jeu
export async function linkTargets(gameId: string) {
  const [characters, factions, intrigues] = await Promise.all([
    prisma.character.findMany({ where: { gameId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.faction.findMany({ where: { gameId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.intrigue.findMany({ where: { gameId }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
  ])
  return { characters, factions, intrigues }
}

/**
 * Liens du jeu qui visent une question et une option du formulaire en vigueur ; un lien vers une question ou une
 * option disparue est ignoré. Une question sur une échelle se relie entière (option vide).
 */
export async function currentQuestionLinks(gameId: string, balance?: Parameters<typeof getCurrentRegistrationForm>[1]) {
  const { definition } = await getCurrentRegistrationForm(gameId, balance)
  return await questionLinksOf(gameId, definition.questions)
}

/** Les mêmes liens, pour qui a déjà lu le formulaire. */
export async function questionLinksOf(gameId: string, questions: RegistrationQuestion[]) {
  const rows = await prisma.registrationQuestionLink.findMany({ where: { gameId }, select: linkSelect })
  const byId = new Map(questions.map((question) => [question.id, question]))
  return rows
    .filter((row) => {
      const question = byId.get(row.questionId)
      if (!question) return false
      return REGISTRATION_CHOICE_TYPES.includes(question.type) ? question.options.includes(row.option) : question.type === 'scale' && row.option === ''
    })
    .map(({ character, faction, intrigue, ...row }) => ({
      ...row,
      target: character ? { kind: 'character', ...character } : faction ? { kind: 'faction', ...faction } : { kind: 'intrigue', ...intrigue! }
    }))
}

/** Remplace les liens du jeu (US-098) : chaque lien vise une question en vigueur, et un élément du jeu. */
export async function saveQuestionLinks(gameId: string, links: LinkInput[]) {
  const { definition } = await getCurrentRegistrationForm(gameId)
  const questions = new Map(definition.questions.map((question) => [question.id, question]))
  for (const link of links) {
    const question = questions.get(link.questionId)
    const valid = question && (REGISTRATION_CHOICE_TYPES.includes(question.type)
      ? question.options.includes(link.option)
      : question.type === 'scale' && link.option === '')
    if (!valid) throw createError({ statusCode: 400, message: 'Un lien vise une question ou une option qui n’existe plus : rechargez le formulaire.' })
  }

  const ids = (key: 'characterId' | 'factionId' | 'intrigueId') => [...new Set(links.map((link) => link[key]).filter((id): id is string => Boolean(id)))]
  const [characters, factions, intrigues] = await Promise.all([
    prisma.character.count({ where: { gameId, id: { in: ids('characterId') } } }),
    prisma.faction.count({ where: { gameId, id: { in: ids('factionId') } } }),
    prisma.intrigue.count({ where: { gameId, id: { in: ids('intrigueId') } } })
  ])
  if (characters !== ids('characterId').length || factions !== ids('factionId').length || intrigues !== ids('intrigueId').length) {
    throw createError({ statusCode: 400, message: 'Personnages, factions ou intrigues invalides pour ce jeu' })
  }

  // Un même lien envoyé deux fois n'est gardé qu'une fois
  const unique = new Map(links.map((link) => [
    [link.questionId, link.option, link.characterId ?? '', link.factionId ?? '', link.intrigueId ?? ''].join('\u0000'),
    { gameId, questionId: link.questionId, option: link.option, characterId: link.characterId ?? null, factionId: link.factionId ?? null, intrigueId: link.intrigueId ?? null }
  ]))
  try {
    await prisma.$transaction([
      prisma.registrationQuestionLink.deleteMany({ where: { gameId } }),
      prisma.registrationQuestionLink.createMany({ data: [...unique.values()] })
    ])
  } catch (error) {
    // Deux enregistrements simultanés insèrent les mêmes liens : les index uniques refusent le second (US-190)
    if (isUniqueConflict(error)) throw createError({ statusCode: 409, message: 'Les liens viennent d’être modifiés par quelqu’un d’autre : rechargez la page avant d’enregistrer.' })
    throw error
  }
  return await currentQuestionLinks(gameId)
}
