import { prisma } from '~/server/utils/prisma'
import { generateSlug } from '~/server/utils/generateSlug'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const slug = generateSlug(body.name)

    const newCharacter = await prisma.character.create({
        data: {
            name: body.name,
            slug,
            description: body.description,
            gameId: body.gameId
        }
    })

    return newCharacter
})
