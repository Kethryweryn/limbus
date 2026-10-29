import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readZodBody, sessionPaymentTariffSchema } from '~/server/utils/schemas'
import { setSessionPaymentTariff } from '~/server/utils/sessionPayments'

// Tarif choisi pour une personne ; null la remet au tarif de son rôle (US-031)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const body = await readZodBody(event, sessionPaymentTariffSchema)
  return await setSessionPaymentTariff(session.id, requireRouterParam(event, 'participantId'), body.tariffId)
})
