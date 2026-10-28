import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { GAME_INVITATION_KINDS } from '~/utils/domain'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireGameOwner(event, id)

  const [shares, invitations] = await Promise.all([
    prisma.gameShare.findMany({
      where: { gameId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      }
    }),
    prisma.gameInvitation.findMany({
      // Les invitations de legs (US-011) se suivent à part (US-012)
      where: { gameId: id, kind: GAME_INVITATION_KINDS.share },
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
        acceptedBy: { select: { id: true, name: true, email: true } }
      }
    })
  ])

  return { shares, invitations }
})
