import { getAuthUser, requireAuthUser } from '~/server/utils/auth'
import { acceptInvitationForUser } from '~/server/utils/invitations'
import { invitationAcceptSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const authPayload = getAuthUser(event)
  if (!authPayload) {
    throw createError({ statusCode: 401, statusMessage: 'Connexion requise' })
  }

  const user = await requireAuthUser(event)
  const body = await readZodBody(event, invitationAcceptSchema)
  const game = await acceptInvitationForUser(body.token, user.id)
  return { success: true, game }
})
