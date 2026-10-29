import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const document = await prisma.document.findUnique({ where: { id }, select: { gameId: true } })
  if (!document) {
    throw createError({ statusCode: 404, message: 'Document introuvable' })
  }
  await requireGameAccess(event, document.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'document', id)

  await prisma.document.delete({ where: { id } })
  return { ok: true }
})
