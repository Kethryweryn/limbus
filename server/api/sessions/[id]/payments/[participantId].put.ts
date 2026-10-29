import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { readZodBody, sessionPaymentStatusSchema } from '~/server/utils/schemas'
import { setSessionPaymentStatus } from '~/server/utils/sessionPayments'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertPaymentUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const participantId = requireRouterParam(event, 'participantId')
  const session = await requireSessionAccess(event, id)

  const body = await readZodBody(event, sessionPaymentStatusSchema)
  await assertPaymentUnmodifiedSince(event, session.id, participantId)
  // Validé hors ligne : la date du clic, pas celle de l'envoi (US-048)
  return await setSessionPaymentStatus(session.id, participantId, body.paid, body.paidAt)
})
