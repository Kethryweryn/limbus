import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { deleteSessionTariff } from '~/server/utils/sessionPayments'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  return await deleteSessionTariff(session.id, requireRouterParam(event, 'tariffId'))
})
