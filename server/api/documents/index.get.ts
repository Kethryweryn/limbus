import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { documentInclude } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const gameId = getQuery(event).gameId?.toString()
  return await prisma.document.findMany({
    where: await gameScopedWhere(event, gameId ? { gameId } : {}),
    orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    include: documentInclude
  })
})
