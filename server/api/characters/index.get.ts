import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    return await prisma.character.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
            game: true
        }
    })
})
