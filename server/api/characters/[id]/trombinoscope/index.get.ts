import { requireOrganizer } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { getCharacterTrombinoscopeConfig } from '~/server/utils/trombinoscopes'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  const character = await prisma.character.findUnique({ where: { id }, select: { gameId: true } })
  if (!character) {
    throw createError({ statusCode: 404, statusMessage: 'Personnage introuvable' })
  }
  await requireGameAccess(event, character.gameId)

  return await getCharacterTrombinoscopeConfig(id)
})
