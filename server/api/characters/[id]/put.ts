import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
    const { id } = event.context.params
    const body = await readBody(event)

    return await prisma.character.update({
        where: { id },
        data: {
            name: body.name,
            description: body.description,
            gameId: body.gameId
        }
    })
})
