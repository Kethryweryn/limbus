import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { collectUploadUrls, deleteUnusedUploads } from '~/server/utils/uploads'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireGameOwner(event, id)

  // Tout le contenu du jeu part en cascade ; les fichiers (photos, RIB) sont effacés ensuite
  const uploadUrls = await collectUploadUrls({ gameId: id })
  await prisma.game.delete({
    where: { id }
  })
  await deleteUnusedUploads(uploadUrls)

  return { success: true }
})
