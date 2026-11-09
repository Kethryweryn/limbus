import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere, queryGameFilter } from '~/server/utils/gameAccess'
import { unlinked } from '~/server/utils/contentLinks'
import { factionInclude } from '~/server/utils/sheetReads'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  return unlinked(await prisma.faction.findMany({
    where: await gameScopedWhere(event, queryGameFilter(event)),
    orderBy: { updatedAt: 'desc' },
    include: factionInclude
  }))
})
