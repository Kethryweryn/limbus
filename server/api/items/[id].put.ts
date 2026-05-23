import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { itemSchema, readZodBody } from '~/server/utils/schemas'
import { itemInclude, validateItemRelations } from '~/server/utils/items'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, itemSchema)
  const participantIds = [...new Set(body.participantIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  await validateItemRelations(body.gameId, participantIds, intrigueIds, body.locationParticipantId)

  return await prisma.item.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      locationText: body.locationParticipantId ? null : body.locationText,
      locationParticipantId: body.locationParticipantId || null,
      gameId: body.gameId,
      published: body.published ?? true,
      participants: {
        set: participantIds.map((participantId) => ({ id: participantId }))
      },
      intrigues: {
        set: intrigueIds.map((intrigueId) => ({ id: intrigueId }))
      }
    },
    include: itemInclude
  })
})
