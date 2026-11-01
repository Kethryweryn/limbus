import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { characterRelationInclude } from '~/server/utils/characterRelations'

// Relations d'un personnage, des deux côtés (US-097)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const character = await prisma.character.findUnique({ where: { id }, select: { gameId: true } })
  if (!character) throw createError({ statusCode: 404, message: 'Personnage introuvable' })
  await requireGameAccess(event, character.gameId)

  return await prisma.characterRelation.findMany({
    where: { OR: [{ fromCharacterId: id }, { toCharacterId: id }] },
    include: characterRelationInclude,
    orderBy: { createdAt: 'asc' }
  })
})
