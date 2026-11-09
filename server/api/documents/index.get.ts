import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { documentInclude } from '~/server/utils/documents'
import { unlinked } from '~/server/utils/contentLinks'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = getQuery(event).gameId?.toString()
  return unlinked(await prisma.document.findMany({
    where: await gameScopedWhere(event, gameId ? { gameId } : {}),
    orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    include: documentInclude
  }))
})
