import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { documentSchema, readZodBody } from '~/server/utils/schemas'
import { documentInclude, validateDocumentRelations } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, documentSchema)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  await validateDocumentRelations(body.gameId, body.characterId, characterIds, factionIds)

  return await prisma.document.update({
    where: { id },
    data: {
      title: body.title,
      content: body.content,
      documentUrl: body.documentUrl,
      gameId: body.gameId,
      characterId: body.characterId || null,
      published: body.published ?? true,
      characters: {
        set: characterIds.map((characterId) => ({ id: characterId }))
      },
      factions: {
        set: factionIds.map((factionId) => ({ id: factionId }))
      }
    },
    include: documentInclude
  })
})
