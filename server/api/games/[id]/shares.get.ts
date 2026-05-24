import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
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
      where: { gameId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
        acceptedBy: { select: { id: true, name: true, email: true } }
      }
    })
  ])

  return { shares, invitations }
})
