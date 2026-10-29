import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { readZodBody, sessionPaymentRefundSchema } from '~/server/utils/schemas'
import { setSessionPaymentRefund } from '~/server/utils/sessionPayments'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertPaymentUnmodifiedSince } from '~/server/utils/concurrency'

// Remboursement d'un paiement d'une session annulée ou reportée (US-023)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const participantId = requireRouterParam(event, 'participantId')
  const session = await requireSessionAccess(event, id)

  const body = await readZodBody(event, sessionPaymentRefundSchema)
  await assertPaymentUnmodifiedSince(event, session.id, participantId)
  return await setSessionPaymentRefund(session.id, participantId, body.status)
})
