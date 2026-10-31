import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { reorderWaitlist } from '~/server/utils/registrationSelection'
import { readZodBody, registrationWaitlistOrderSchema } from '~/server/utils/schemas'

// Ordre de la liste d'attente d'une session, fixé par les orgas (US-087, R19)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  const body = await readZodBody(event, registrationWaitlistOrderSchema)

  return await reorderWaitlist(period.id, body.sessionId, body.registrationIds)
})
