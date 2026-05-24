import { requireOrganizer } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { getSessionDocumentDashboard } from '~/server/utils/documents'
import { requireGameAccess } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  const session = await prisma.session.findUnique({ where: { id }, select: { gameId: true } })
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session introuvable' })
  }
  await requireGameAccess(event, session.gameId)

  return await getSessionDocumentDashboard(id)
})
