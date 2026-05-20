import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    const slug = event.context.params?.slug
    if (!slug) throw createError({ statusCode: 400, message: 'Slug manquant' })

    const game = await prisma.game.findUnique({ where: { slug } })
    if (!game) throw createError({ statusCode: 404, message: 'Jeu non trouvé' })

    return game
})
