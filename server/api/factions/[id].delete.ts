import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const faction = await prisma.faction.findUnique({ where: { id }, select: { gameId: true } })
  if (!faction) {
    throw createError({ statusCode: 404, message: 'Groupe introuvable' })
  }
  await requireGameAccess(event, faction.gameId)

  await prisma.faction.delete({
    where: { id }
  })

  return { success: true }
})
