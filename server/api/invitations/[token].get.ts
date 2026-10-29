import { getValidInvitation } from '~/server/utils/invitations'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  const token = requireRouterParam(event, 'token')

  const invitation = await getValidInvitation(token)
  return {
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    kind: invitation.kind,
    inviterName: invitation.invitedBy.name || invitation.invitedBy.email,
    game: { id: invitation.game.id, title: invitation.game.title, slug: invitation.game.slug }
  }
})
