import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { documentInclude } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const gameId = getQuery(event).gameId?.toString()
  return await prisma.document.findMany({
    where: gameId ? { gameId } : undefined,
    orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    include: documentInclude
  })
})
