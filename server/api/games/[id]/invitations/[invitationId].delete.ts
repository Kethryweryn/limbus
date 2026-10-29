import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { GAME_INVITATION_KINDS } from '~/utils/domain'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const invitationId = requireRouterParam(event, 'invitationId')
  await requireGameOwner(event, id)

  await prisma.gameInvitation.deleteMany({
    where: {
      id: invitationId,
      gameId: id,
      // Une invitation de legs s'annule avec sa copie (US-012)
      kind: GAME_INVITATION_KINDS.share
    }
  })

  return { success: true }
})
