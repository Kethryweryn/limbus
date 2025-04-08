import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
    const slug = event.context.params?.slug
    if (!slug) throw createError({ statusCode: 400, message: 'Slug manquant' })

    const game = await prisma.game.findUnique({ where: { slug } })
    if (!game) throw createError({ statusCode: 404, message: 'Jeu non trouvé' })

    return game
})
