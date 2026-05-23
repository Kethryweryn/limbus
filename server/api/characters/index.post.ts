import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { createCharacterSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    const body = await readZodBody(event, createCharacterSchema)
    const slug = await generateUniqueSlug('character', body.name)

    if (body.factionIds.length) {
        const matchingFactions = await prisma.faction.count({
            where: {
                id: { in: body.factionIds },
                gameId: body.gameId
            }
        })

        if (matchingFactions !== body.factionIds.length) {
            throw createError({ statusCode: 400, statusMessage: 'Groupes invalides pour ce jeu' })
        }
    }

    const newCharacter = await prisma.character.create({
        data: {
            name: body.name,
            type: body.type,
            slug,
            pitch: body.pitch,
            background: body.background,
            backgroundDocumentUrl: body.backgroundDocumentUrl,
            sheetReadyToSend: body.sheetReadyToSend ?? false,
            costumeIndications: body.costumeIndications,
            gameId: body.gameId,
            factions: {
                connect: body.factionIds.map((id) => ({ id }))
            }
        },
        include: {
            game: true,
            factions: true
        }
    })

    return newCharacter
})
