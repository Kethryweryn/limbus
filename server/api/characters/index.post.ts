import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    const body = await readBody(event)
    const slug = await generateUniqueSlug('character', body.name)

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
