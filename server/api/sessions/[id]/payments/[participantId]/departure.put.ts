import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readZodBody, sessionPaymentDepartureSchema } from '~/server/utils/schemas'
import { setDepartedPaymentStatus } from '~/server/utils/sessionPayments'

// Paiement d'une personne partie : rembourser, garder ou transférer au remplaçant (US-039)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const body = await readZodBody(event, sessionPaymentDepartureSchema)
  return await setDepartedPaymentStatus(session.id, requireRouterParam(event, 'participantId'), body.status, body.transferToParticipantId)
})
