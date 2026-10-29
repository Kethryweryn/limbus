import { requireUser } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { getCharacterTrombinoscopeConfig } from '~/server/utils/trombinoscopes'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const character = await prisma.character.findUnique({ where: { id }, select: { gameId: true } })
  if (!character) {
    throw createError({ statusCode: 404, message: 'Personnage introuvable' })
  }
  await requireGameAccess(event, character.gameId)

  return await getCharacterTrombinoscopeConfig(id)
})
