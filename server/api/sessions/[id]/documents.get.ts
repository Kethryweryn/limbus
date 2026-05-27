import { requireOrganizer } from '~/server/utils/auth'
import { getSessionDocumentDashboard } from '~/server/utils/documents'
import { requireSessionAccess } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const session = await requireSessionAccess(event, id)

  return await getSessionDocumentDashboard(session.id)
})
