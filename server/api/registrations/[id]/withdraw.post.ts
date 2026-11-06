import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { cancelRegistrationSession, findRegistrationOr404, leavePool } from '~/server/utils/registrations'
import { readZodBody, registrationTargetSchema } from '~/server/utils/schemas'

// Retrait par une organisatrice : d'une session (R19), ou du vivier sans session donnée (R5)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  const { sessionId } = await readZodBody(event, registrationTargetSchema)

  if (sessionId) await cancelRegistrationSession(registration.id, sessionId, user)
  else await leavePool(registration.id, user)
  return { success: true }
})
