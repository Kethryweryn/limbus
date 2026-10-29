import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readZodBody, sessionPaymentInstalmentSchema } from '~/server/utils/schemas'
import { addSessionPaymentInstalment } from '~/server/utils/sessionPayments'

// Versement reçu d'une personne (US-032)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const body = await readZodBody(event, sessionPaymentInstalmentSchema)
  return await addSessionPaymentInstalment(session.id, requireRouterParam(event, 'participantId'), body)
})
