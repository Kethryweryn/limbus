import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { setPoolSeats } from '~/server/utils/registrationSelection'
import { readZodBody, registrationPoolSeatsSchema } from '~/server/utils/schemas'

// Places d'une session recrutée par l'inscription permanente (US-090, R5)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  const body = await readZodBody(event, registrationPoolSeatsSchema)

  return await setPoolSeats(period.id, body.sessionId, body.seats)
})
