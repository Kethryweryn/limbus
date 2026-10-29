import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const location = await prisma.location.findUnique({ where: { id }, select: { gameId: true } })
  if (!location) {
    throw createError({ statusCode: 404, message: 'Lieu introuvable' })
  }
  await requireGameAccess(event, location.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'location', id)

  await prisma.session.updateMany({
    where: { locationId: id },
    data: { locationId: null }
  })

  return await prisma.location.delete({
    where: { id }
  })
})
