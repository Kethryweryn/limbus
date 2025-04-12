import { prisma } from '~/server/utils/prisma'
import { getAuthUser } from '@/server/utils/auth'
import { generateSlug } from '~/server/utils/generateSlug'

export default defineEventHandler(async (event) => {
    const user = getAuthUser(event)
    if (!user || user.role !== 'organizer') {
        return sendError(event, createError({ statusCode: 403, statusMessage: 'Forbidden' }))
    }

    const id = getRouterParam(event, 'id')
    if (!id) {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'ID manquant' }))
    }
    const body = await readBody(event)

    const slug = generateSlug(body.name)

    return await prisma.character.update({
        where: { id },
        data: {
            name: body.name,
            description: body.description,
            gameId: body.gameId,
            published: body.published,
            slug
        }
    })
})
