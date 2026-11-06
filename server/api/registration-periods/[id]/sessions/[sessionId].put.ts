import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { updateRegistrationSession } from '~/server/utils/registrationPeriodWrites'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readZodBody, registrationSessionSettingsSchema } from '~/server/utils/schemas'

// Ouvrir ou refermer une session à la pré-inscription, et régler sa sélection (R6, R22)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  const body = await readZodBody(event, registrationSessionSettingsSchema)

  return await updateRegistrationSession(period, requireRouterParam(event, 'sessionId'), body)
})
