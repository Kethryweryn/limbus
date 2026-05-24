import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  const document = await prisma.document.findUnique({ where: { id }, select: { gameId: true } })
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document introuvable' })
  }
  await requireGameAccess(event, document.gameId)

  await prisma.document.delete({ where: { id } })
  return { ok: true }
})
