import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  const timelineEvent = await prisma.timelineEvent.findUnique({ where: { id }, select: { gameId: true } })
  if (!timelineEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable' })
  }
  await requireGameAccess(event, timelineEvent.gameId)

  await prisma.timelineEvent.delete({ where: { id } })
  return { ok: true }
})
