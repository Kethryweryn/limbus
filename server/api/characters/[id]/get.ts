import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    const { id } = event.context.params
    return await prisma.character.findUnique({
        where: { id },
        include: {
            game: true,
            intrigues: true,
            factions: true
        }
    })
})
