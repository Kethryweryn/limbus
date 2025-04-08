import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
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
