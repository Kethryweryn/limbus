import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { itemSchema, readZodBody } from '~/server/utils/schemas'
import { itemInclude, validateItemRelations } from '~/server/utils/items'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, itemSchema)
  const participantIds = [...new Set(body.participantIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  await validateItemRelations(body.gameId, participantIds, intrigueIds, body.locationParticipantId)

  return await prisma.item.create({
    data: {
      name: body.name,
      description: body.description,
      quantity: 1,
      locationText: body.locationParticipantId ? null : body.locationText,
      locationParticipantId: body.locationParticipantId || null,
      gameId: body.gameId,
      published: body.published ?? true,
      participants: {
        connect: participantIds.map((participantId) => ({ id: participantId }))
      },
      intrigues: {
        connect: intrigueIds.map((intrigueId) => ({ id: intrigueId }))
      }
    },
    include: itemInclude
  })
})
