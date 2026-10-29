import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { extendRegistrationDeadline, findRegistrationOr404 } from '~/server/utils/registrations'
import { readZodBody, registrationExtensionSchema } from '~/server/utils/schemas'

// Prolonge l'échéance d'une invitation sans réponse (US-005, R20)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  const { responseDueAt } = await readZodBody(event, registrationExtensionSchema)

  return await extendRegistrationDeadline(registration.id, responseDueAt)
})
