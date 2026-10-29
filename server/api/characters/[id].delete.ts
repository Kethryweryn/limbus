import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { collectUploadUrls, deleteUnusedUploads } from '~/server/utils/uploads'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const character = await prisma.character.findUnique({
    where: { id },
    select: { gameId: true }
  })
  if (!character) {
    throw createError({ statusCode: 404, message: 'Personnage introuvable' })
  }
  await requireGameAccess(event, character.gameId)

  // Ses assignations de session partent avec lui, photos comprises
  const uploadUrls = await collectUploadUrls({ characterId: id })
  const deleted = await prisma.character.delete({
    where: { id }
  })
  await deleteUnusedUploads(uploadUrls)
  return deleted
})
