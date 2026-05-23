import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { documentSchema, readZodBody } from '~/server/utils/schemas'
import { documentInclude, validateDocumentRelations } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, documentSchema)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  await validateDocumentRelations(body.gameId, body.characterId, characterIds, factionIds)

  return await prisma.document.create({
    data: {
      title: body.title,
      content: body.content,
      documentUrl: body.documentUrl,
      audience: body.audience,
      gameId: body.gameId,
      characterId: body.characterId || null,
      published: body.published ?? true,
      characters: {
        connect: characterIds.map((id) => ({ id }))
      },
      factions: {
        connect: factionIds.map((id) => ({ id }))
      }
    },
    include: documentInclude
  })
})
