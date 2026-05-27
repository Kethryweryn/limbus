import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const invitationId = getRouterParam(event, 'invitationId')
  if (!id || !invitationId) {
    throw createError({ statusCode: 400, message: 'Paramètre manquant' })
  }
  await requireGameOwner(event, id)

  await prisma.gameInvitation.deleteMany({
    where: {
      id: invitationId,
      gameId: id
    }
  })

  return { success: true }
})
