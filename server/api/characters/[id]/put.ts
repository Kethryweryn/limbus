import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
    }

    const body = await readBody(event)
    const { name, description, gameId, published } = body

    const data: any = {
        description,
        gameId,
        published
    }

    if (name) {
        data.name = name
        data.slug = await generateUniqueSlug('character', name, id)
    }

    return await prisma.character.update({
        where: { id },
        data
    })
})
