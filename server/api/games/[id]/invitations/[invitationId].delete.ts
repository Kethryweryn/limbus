import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { GAME_INVITATION_STATUSES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const invitationId = getRouterParam(event, 'invitationId')
  if (!id || !invitationId) {
    throw createError({ statusCode: 400, statusMessage: 'Paramètre manquant' })
  }
  await requireGameOwner(event, id)

  await prisma.gameInvitation.updateMany({
    where: {
      id: invitationId,
      gameId: id,
      status: GAME_INVITATION_STATUSES.pending
    },
    data: {
      status: GAME_INVITATION_STATUSES.revoked
    }
  })

  return { success: true }
})
