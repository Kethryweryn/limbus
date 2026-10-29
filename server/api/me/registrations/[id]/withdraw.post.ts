import { requireUser } from '~/server/utils/auth'
import { withdrawRegistration } from '~/server/utils/registrations'
import { exposePublicRegistration, registrationPermissions, requireMyRegistration } from '~/server/utils/publicRegistrations'

// Se désister depuis le compte, comme par le lien personnel (US-072, US-006)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const registration = await requireMyRegistration(user.id, id)
  if (!registrationPermissions(registration).canWithdraw) {
    throw createError({ statusCode: 409, message: 'Seule une inscription confirmée peut faire l’objet d’un désistement.' })
  }

  await withdrawRegistration(registration.id, null)
  return await exposePublicRegistration(await requireMyRegistration(user.id, id))
})
