import { requireUser } from '~/server/utils/auth'
import { cancelRegistrationSession } from '~/server/utils/registrations'
import { exposeMyRegistration, requireMyRegistration } from '~/server/utils/publicRegistrations'
import { readZodBody, registrationSessionTargetSchema } from '~/server/utils/schemas'

// Annuler sa présence à une session depuis le compte (R19) : la personne reste dans le vivier
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const registration = await requireMyRegistration(user.id, id)
  const { sessionId } = await readZodBody(event, registrationSessionTargetSchema)

  await cancelRegistrationSession(registration.id, sessionId, null)
  return await exposeMyRegistration(await requireMyRegistration(user.id, id), user.email)
})
