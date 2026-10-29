import { requireUser } from '~/server/utils/auth'
import { exposeMyRegistration, requireMyRegistration } from '~/server/utils/publicRegistrations'

// Une de mes inscriptions, vue comme par le lien personnel (US-072)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await exposeMyRegistration(await requireMyRegistration(user.id, getRouterParam(event, 'id')), user.email)
})
