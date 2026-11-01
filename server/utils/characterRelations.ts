import { prisma } from '~/server/utils/prisma'
import { relationSheetLine } from '~/utils/characterRelations'

// Relations entre personnages (US-097, ADR-0050)
export const characterRelationInclude = {
  fromCharacter: { select: { id: true, name: true, slug: true } },
  toCharacter: { select: { id: true, name: true, slug: true } }
} as const

export async function findCharacterRelationOr404(id: string) {
  const relation = await prisma.characterRelation.findUnique({ where: { id }, select: { id: true, gameId: true } })
  if (!relation) throw createError({ statusCode: 404, message: 'Relation introuvable' })
  return relation
}

/** Les deux personnages d'une relation appartiennent au même jeu ; renvoie ce jeu. */
export async function relationGameId(fromCharacterId: string, toCharacterId: string) {
  const characters = await prisma.character.findMany({ where: { id: { in: [fromCharacterId, toCharacterId] } }, select: { gameId: true } })
  if (characters.length !== 2 || characters[0]!.gameId !== characters[1]!.gameId) {
    throw createError({ statusCode: 400, message: 'Les deux personnages doivent appartenir au même jeu' })
  }
  return characters[0]!.gameId
}

// Relations d'un personnage visibles de son joueur, à inclure dans la lecture du personnage pour sa fiche (US-097)
export const sheetRelationsInclude = {
  relationsFrom: { where: { fromVisible: true }, include: characterRelationInclude, orderBy: { createdAt: 'asc' } },
  relationsTo: { where: { toVisible: true }, include: characterRelationInclude, orderBy: { createdAt: 'asc' } }
} as const

type WithSheetRelations = { id: string, relationsFrom: Parameters<typeof relationSheetLine>[0][], relationsTo: Parameters<typeof relationSheetLine>[0][] }

/** Le personnage, sans ses relations brutes, avec les lignes « Relations » de sa fiche. */
export function withSheetRelationLines<T extends WithSheetRelations>({ relationsFrom, relationsTo, ...character }: T) {
  return { ...character, relationLines: [...relationsFrom, ...relationsTo].map((relation) => relationSheetLine(relation, character.id)) }
}
