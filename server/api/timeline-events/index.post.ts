import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, timelineEventSchema } from '~/server/utils/schemas'
import { timelineEventInclude, validateTimelineEventRelations } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, timelineEventSchema)
  const characterIds = [...new Set(body.characterIds)]
  const intrigueIds = [...new Set(body.intrigueIds)]
  const itemIds = [...new Set(body.itemIds)]
  await validateTimelineEventRelations(body.gameId, characterIds, intrigueIds, itemIds)

  return await prisma.timelineEvent.create({
    data: {
      name: body.name,
      description: body.description,
      day: body.day,
      time: body.time,
      requiredResponsibles: body.requiredResponsibles,
      gameId: body.gameId,
      published: body.published ?? true,
      characters: { connect: characterIds.map((id) => ({ id })) },
      intrigues: { connect: intrigueIds.map((id) => ({ id })) },
      items: { connect: itemIds.map((id) => ({ id })) }
    },
    include: timelineEventInclude
  })
})
