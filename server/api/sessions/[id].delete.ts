import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { collectUploadUrls, deleteUnusedUploads } from '~/server/utils/uploads'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const session = await requireSessionAccess(event, id)

  const uploadUrls = await collectUploadUrls({ sessionId: session.id })
  await prisma.session.delete({
    where: { id: session.id }
  })
  await deleteUnusedUploads(uploadUrls)

  return { success: true }
})
