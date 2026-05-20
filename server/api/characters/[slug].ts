import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    const { slug } = event.context.params
    return await prisma.character.findUnique({
        where: { slug },
        include: {
            game: true,
            intrigues: true,
            factions: true
        }
    })
})
