import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { readZodBody, sessionPaymentStatusSchema } from '~/server/utils/schemas'
import { setSessionPaymentStatus } from '~/server/utils/sessionPayments'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const participantId = requireRouterParam(event, 'participantId')
  await requireSessionAccess(event, id)

  const body = await readZodBody(event, sessionPaymentStatusSchema)
  return await setSessionPaymentStatus(id, participantId, body.paid)
})
