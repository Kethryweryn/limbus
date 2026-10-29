import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { getSessionPaymentDashboard } from '~/server/utils/sessionPayments'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)

  return await getSessionPaymentDashboard(session.id)
})
