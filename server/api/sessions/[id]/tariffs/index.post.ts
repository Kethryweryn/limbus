import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readZodBody, sessionTariffSchema } from '~/server/utils/schemas'
import { createSessionTariff } from '~/server/utils/sessionPayments'

// Tarif de la PAF d'une session (US-031)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const body = await readZodBody(event, sessionTariffSchema)
  return await createSessionTariff(session.id, body)
})
