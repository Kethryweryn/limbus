import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { collectUploadUrls, deleteUnusedUploads } from '~/server/utils/uploads'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const character = await prisma.character.findUnique({
    where: { id },
    select: { gameId: true }
  })
  if (!character) {
    throw createError({ statusCode: 404, message: 'Personnage introuvable' })
  }
  await requireGameAccess(event, character.gameId)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'character', id)

  // Ses assignations de session partent avec lui, photos comprises
  const uploadUrls = await collectUploadUrls({ characterId: id })
  const deleted = await prisma.character.delete({
    where: { id }
  })
  await deleteUnusedUploads(uploadUrls)
  return deleted
})
