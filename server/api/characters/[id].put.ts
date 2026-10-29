import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { requireGameAccess, assertSameGame } from '~/server/utils/gameAccess'
import { readZodBody, updateCharacterSchema } from '~/server/utils/schemas'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { assertGameUploads, deleteUnusedUploads } from '~/server/utils/uploads'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')

  const existingCharacter = await prisma.character.findUnique({
    where: { id },
    select: { gameId: true, trombinoscopePhotoUrl: true }
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
    factionIds
  } = body
  assertSameGame(existingCharacter.gameId, gameId)
  const targetGameId = existingCharacter.gameId
  await assertGameUploads([trombinoscopePhotoUrl], targetGameId, { sessionFiles: false, keep: [existingCharacter.trombinoscopePhotoUrl], label: 'Photo de trombinoscope' })
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
    trombinoscopeDisplayName
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

  const character = await prisma.character.update({
    where: { id },
    data,
    include: {
      game: true,
      factions: true
    }
  })
  await deleteUnusedUploads([existingCharacter.trombinoscopePhotoUrl])
  return character
})
