import { getValidInvitation } from '~/server/utils/invitations'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, message: 'Token manquant' })
  }

  const invitation = await getValidInvitation(token)
  return {
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    game: invitation.game
  }
})
