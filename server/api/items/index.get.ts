import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { itemInclude } from '~/server/utils/items'
import { unlinked } from '~/server/utils/contentLinks'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  return unlinked(await prisma.item.findMany({
    where: await gameScopedWhere(event),
    orderBy: { updatedAt: 'desc' },
    include: itemInclude
  }))
})
