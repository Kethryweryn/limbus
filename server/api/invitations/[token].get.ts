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
    kind: invitation.kind,
    inviterName: invitation.invitedBy.name || invitation.invitedBy.email,
    game: { id: invitation.game.id, title: invitation.game.title, slug: invitation.game.slug }
  }
})
