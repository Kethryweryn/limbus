import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { GAME_INVITATION_KINDS } from '~/utils/domain'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
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
      // L'empreinte du jeton ne sort pas (ADR-0034)
      omit: { token: true, tokenHash: true },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
        acceptedBy: { select: { id: true, name: true, email: true } }
      }
    })
  ])

  return { shares, invitations }
})
