import { requireUser } from '~/server/utils/auth'
import { declineRegistration, exposePublicRegistration, requireMyRegistration } from '~/server/utils/publicRegistrations'

// Décliner une invitation depuis le compte (US-072)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  await declineRegistration(await requireMyRegistration(user.id, id))
  return await exposePublicRegistration(await requireMyRegistration(user.id, id))
})
