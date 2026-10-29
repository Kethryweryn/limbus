import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const timelineEvent = await prisma.timelineEvent.findUnique({ where: { id }, select: { gameId: true } })
  if (!timelineEvent) {
    throw createError({ statusCode: 404, message: 'Événement introuvable' })
  }
  await requireGameAccess(event, timelineEvent.gameId)

  await prisma.timelineEvent.delete({ where: { id } })
  return { ok: true }
})
