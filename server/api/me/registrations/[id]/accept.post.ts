import { requireUser } from '~/server/utils/auth'
import { confirmRetainedPlace } from '~/server/utils/registrationSelection'
import { exposeMyRegistration, requireMyRegistration } from '~/server/utils/publicRegistrations'

// Confirmer sa place retenue depuis le compte, comme par le lien personnel (US-089)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  await confirmRetainedPlace(await requireMyRegistration(user.id, id))
  return await exposeMyRegistration(await requireMyRegistration(user.id, id), user.email)
})
