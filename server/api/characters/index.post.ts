import { prisma } from '~/server/utils/prisma'
import { assertBalanceValue } from '~/server/utils/registrationDraws'
import { CHARACTER_TYPES } from '~/utils/domain'
import { requireUser } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { createCharacterSchema, readZodBody } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertGameUploads } from '~/server/utils/uploads'

export default defineEventHandler(async (event) => {
    await requireUser(event)

    const body = await readZodBody(event, createCharacterSchema)
    await requireGameAccess(event, body.gameId)
    await assertGameUploads([body.trombinoscopePhotoUrl], body.gameId, { sessionFiles: false, label: 'Photo de trombinoscope' })
    await assertBalanceValue(body.gameId, body.balanceValue)
    const slug = await generateUniqueSlug('character', body.name)

    if (body.factionIds.length) {
        const matchingFactions = await prisma.faction.count({
            where: {
                id: { in: body.factionIds },
                gameId: body.gameId
            }
        })

        if (matchingFactions !== body.factionIds.length) {
            throw createError({ statusCode: 400, message: 'Groupes invalides pour ce jeu' })
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
            excludeFromTrombinoscope: body.excludeFromTrombinoscope ?? false,
            trombinoscopeFaceHidden: body.trombinoscopeFaceHidden ?? false,
            trombinoscopePhotoUrl: body.trombinoscopePhotoUrl,
            trombinoscopeNote: body.trombinoscopeNote,
            trombinoscopeDisplayName: body.trombinoscopeDisplayName,
            // Seul un PJ porte une valeur d'équilibre (US-091)
            balanceValue: body.type === CHARACTER_TYPES.pj ? body.balanceValue || null : null,
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
