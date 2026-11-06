import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { drawSession } from '~/server/utils/registrationDraws'
import { readZodBody, registrationDrawSchema } from '~/server/utils/schemas'

// Tirer au sort les pré-inscrits d'une session (R22) : des décisions à annoncer, rien n'est envoyé
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const period = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  const { sessionId } = await readZodBody(event, registrationDrawSchema)

  return await drawSession(period.id, sessionId, user)
})
