import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

// Retirer un partage : la propriétaire, ou la co-organisatrice qui quitte elle-même le jeu (US-059)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const userId = requireRouterParam(event, 'userId')
  const ownShare = userId === user.id && await prisma.gameShare.findFirst({
    where: { gameId: id, userId, game: { bequestPending: false } },
    select: { id: true }
  })
  if (!ownShare) await requireGameOwner(event, id)

  await prisma.$transaction([
    prisma.gameShare.deleteMany({ where: { gameId: id, userId } }),
    // Plus co-organisatrice : un transfert qui lui était proposé tombe
    prisma.game.updateMany({ where: { id, transferToUserId: userId }, data: { transferToUserId: null } })
  ])

  return { success: true }
})
