import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    return await prisma.character.findMany({
        where: await gameScopedWhere(event),
        orderBy: { updatedAt: 'desc' },
        include: {
            game: true,
            factions: true
        }
    })
})
