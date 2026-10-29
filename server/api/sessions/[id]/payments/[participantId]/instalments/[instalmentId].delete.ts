import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { deleteSessionPaymentInstalment } from '~/server/utils/sessionPayments'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  return await deleteSessionPaymentInstalment(session.id, requireRouterParam(event, 'participantId'), requireRouterParam(event, 'instalmentId'))
})
