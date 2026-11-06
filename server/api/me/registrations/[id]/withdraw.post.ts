import { requireUser } from '~/server/utils/auth'
import { leavePool } from '~/server/utils/registrations'
import { exposeMyRegistration, registrationPermissions, requireMyRegistration } from '~/server/utils/publicRegistrations'

// Quitter le vivier depuis le compte, comme par le lien personnel (R5)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const registration = await requireMyRegistration(user.id, id)
  if (!registrationPermissions(registration).canLeave) {
    throw createError({ statusCode: 409, message: 'Vous n’êtes pas dans le vivier de ce jeu.' })
  }

  await leavePool(registration.id, null)
  return await exposeMyRegistration(await requireMyRegistration(user.id, id), user.email)
})
