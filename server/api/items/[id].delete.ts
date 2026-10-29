import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const item = await prisma.item.findUnique({ where: { id }, select: { gameId: true } })
  if (!item) {
    throw createError({ statusCode: 404, message: 'Objet introuvable' })
  }
  await requireGameAccess(event, item.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'item', id)

  await prisma.item.delete({ where: { id } })

  return { success: true }
})
