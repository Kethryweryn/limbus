import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertPaymentUnmodifiedSince } from '~/server/utils/concurrency'
import { readZodBody, sessionPaymentTariffSchema } from '~/server/utils/schemas'
import { setSessionPaymentTariff } from '~/server/utils/sessionPayments'

// Tarif choisi pour une personne ; null la remet au tarif de son rôle (US-031)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const body = await readZodBody(event, sessionPaymentTariffSchema)
  await assertPaymentUnmodifiedSince(event, session.id, requireRouterParam(event, 'participantId'))
  return await setSessionPaymentTariff(session.id, requireRouterParam(event, 'participantId'), body.tariffId)
})
