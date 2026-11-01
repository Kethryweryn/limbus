import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { drawPeriod } from '~/server/utils/registrationDraws'

// Tirer au sort les inscriptions reçues de la période (US-093) : des décisions à annoncer, rien n'est envoyé
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)

  return await drawPeriod(period.id, user)
})
