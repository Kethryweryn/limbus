import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere, queryGameFilter } from '~/server/utils/gameAccess'
import { unlinked } from '~/server/utils/contentLinks'

export default defineEventHandler(async (event) => {
    await requireUser(event)

    return unlinked(await prisma.character.findMany({
        where: await gameScopedWhere(event, queryGameFilter(event)),
        orderBy: { updatedAt: 'desc' },
        include: {
            game: true,
            factionLinks: { select: { faction: true } },
            intrigueLinks: { select: { intrigue: { select: { id: true, level: true } } } }
        }
    }))
})
