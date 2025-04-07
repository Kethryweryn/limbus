import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
    const slug = getRouterParam(event, 'slug')!

    const game = await prisma.game.findUnique({
        where: { slug },
        select: {
            id: true,
            title: true,
            teaserUrl: true,
            description: true,
            noteIntention: true
        }
    })

    if (!game) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Jeu introuvable' }))
    }

    return game
})
