import { requireUser } from '~/server/utils/auth'
import { getSessionDocumentDashboard } from '~/server/utils/documents'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)

  return await getSessionDocumentDashboard(session.id)
})
