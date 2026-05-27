import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { documentSchema, readZodBody } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { documentInclude, validateDocumentRelations } from '~/server/utils/documents'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const body = await readZodBody(event, documentSchema)
  await requireGameAccess(event, body.gameId)
  const characterIds = [...new Set(body.characterIds)]
  const factionIds = [...new Set(body.factionIds)]
  await validateDocumentRelations(body.gameId, body.characterId, characterIds, factionIds)

  return await prisma.document.create({
    data: {
      title: body.title,
      slug: await generateUniqueSlug('document', body.title),
      content: body.content,
      documentUrl: body.documentUrl,
      audience: body.audience,
      readyToSend: body.readyToSend ?? false,
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
