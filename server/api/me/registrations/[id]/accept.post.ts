import { requireUser } from '~/server/utils/auth'
import { confirmRetainedPlace } from '~/server/utils/registrationSelection'
import { exposeMyRegistration, requireMyRegistration } from '~/server/utils/publicRegistrations'
import { readZodBody, registrationSessionTargetSchema } from '~/server/utils/schemas'

// Confirmer sa place retenue pour une session depuis le compte, comme par le lien personnel (US-089)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const registration = await requireMyRegistration(user.id, id)
  const { sessionId } = await readZodBody(event, registrationSessionTargetSchema)

  await confirmRetainedPlace(registration, sessionId)
  return await exposeMyRegistration(await requireMyRegistration(user.id, id), user.email)
})
