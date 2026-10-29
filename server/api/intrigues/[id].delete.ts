import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const intrigue = await prisma.intrigue.findUnique({ where: { id }, select: { gameId: true } })
  if (!intrigue) {
    throw createError({ statusCode: 404, message: 'Intrigue introuvable' })
  }
  await requireGameAccess(event, intrigue.gameId)

  await prisma.intrigue.delete({
    where: { id }
  })

  return { success: true }
})
