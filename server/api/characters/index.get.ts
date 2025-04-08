import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
    return await prisma.character.findMany({
        include: {
            game: true
        }
    })
})
