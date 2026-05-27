import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { readZodBody, updateCharacterSchema } from '~/server/utils/schemas'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }

  const existingCharacter = await prisma.character.findUnique({
    where: { id },
    select: { gameId: true }
  })
  if (!existingCharacter) {
    throw createError({ statusCode: 404, message: 'Personnage introuvable' })
  }
  await requireGameAccess(event, existingCharacter.gameId)
  await assertUnmodifiedSince(event, 'character', id)

  const body = await readZodBody(event, updateCharacterSchema)
  const {
    name,
    type,
    pitch,
    background,
    backgroundDocumentUrl,
    sheetReadyToSend,
    costumeIndications,
    excludeFromTrombinoscope,
    trombinoscopeFaceHidden,
    trombinoscopePhotoUrl,
    trombinoscopeNote,
    trombinoscopeDisplayName,
    gameId,
    factionIds,
    published
  } = body
  const targetGameId = gameId || existingCharacter?.gameId
  if (gameId && gameId !== existingCharacter.gameId) {
    await requireGameAccess(event, gameId)
  }
  if (factionIds && targetGameId) {
    const matchingFactions = await prisma.faction.count({
      where: {
        id: { in: factionIds },
        gameId: targetGameId
      }
    })

    if (matchingFactions !== factionIds.length) {
      throw createError({ statusCode: 400, message: 'Groupes invalides pour ce jeu' })
    }
  }

  const data: any = {
    pitch,
    type,
    background,
    backgroundDocumentUrl,
    sheetReadyToSend,
    costumeIndications,
    excludeFromTrombinoscope,
    trombinoscopeFaceHidden,
    trombinoscopePhotoUrl,
    trombinoscopeNote,
    trombinoscopeDisplayName,
    gameId,
    published
  }

  if (name) {
    data.name = name
    data.slug = await generateUniqueSlug('character', name, id)
  }

  if (factionIds) {
    data.factions = {
      set: factionIds.map((factionId) => ({ id: factionId }))
    }
  }

  return await prisma.character.update({
    where: { id },
    data,
    include: {
      game: true,
      factions: true
    }
  })
})
