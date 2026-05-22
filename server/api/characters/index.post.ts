import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { createCharacterSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    const body = await readZodBody(event, createCharacterSchema)
    const slug = await generateUniqueSlug('character', body.name)

    const newCharacter = await prisma.character.create({
        data: {
            name: body.name,
            slug,
            pitch: body.pitch,
            background: body.background,
            backgroundDocumentUrl: body.backgroundDocumentUrl,
            costumeIndications: body.costumeIndications,
            gameId: body.gameId
        }
    })

    return newCharacter
})
