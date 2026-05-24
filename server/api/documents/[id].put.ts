import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { documentSchema, readZodBody } from '~/server/utils/schemas'
import { documentInclude, validateDocumentRelations } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  const document = await prisma.document.findUnique({ where: { id }, select: { gameId: true } })
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document introuvable' })
  }
  await requireGameAccess(event, document.gameId)

  const body = await readZodBody(event, documentSchema)
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  await validateDocumentRelations(body.gameId, body.characterId, characterIds, factionIds)

  return await prisma.document.update({
    where: { id },
    data: {
      title: body.title,
      content: body.content,
      documentUrl: body.documentUrl,
      audience: body.audience,
      readyToSend: body.readyToSend ?? false,
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
