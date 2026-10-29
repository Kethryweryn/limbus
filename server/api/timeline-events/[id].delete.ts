import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const timelineEvent = await prisma.timelineEvent.findUnique({ where: { id }, select: { gameId: true } })
  if (!timelineEvent) {
    throw createError({ statusCode: 404, message: 'Événement introuvable' })
  }
  await requireGameAccess(event, timelineEvent.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'timelineEvent', id)

  await prisma.timelineEvent.delete({ where: { id } })
  return { ok: true }
})
