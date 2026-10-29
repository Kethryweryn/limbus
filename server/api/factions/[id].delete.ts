import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const faction = await prisma.faction.findUnique({ where: { id }, select: { gameId: true } })
  if (!faction) {
    throw createError({ statusCode: 404, message: 'Groupe introuvable' })
  }
  await requireGameAccess(event, faction.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'faction', id)

  await prisma.faction.delete({
    where: { id }
  })

  return { success: true }
})
