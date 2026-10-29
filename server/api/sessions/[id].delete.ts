import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { collectUploadUrls, deleteUnusedUploads } from '~/server/utils/uploads'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)

  const uploadUrls = await collectUploadUrls({ sessionId: session.id })
  await prisma.session.delete({
    where: { id: session.id }
  })
  await deleteUnusedUploads(uploadUrls)

  return { success: true }
})
