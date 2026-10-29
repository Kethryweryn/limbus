import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const intrigue = await prisma.intrigue.findUnique({ where: { id }, select: { gameId: true } })
  if (!intrigue) {
    throw createError({ statusCode: 404, message: 'Intrigue introuvable' })
  }
  await requireGameAccess(event, intrigue.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'intrigue', id)

  await prisma.intrigue.delete({
    where: { id }
  })

  return { success: true }
})
