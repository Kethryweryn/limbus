import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { participantSchema, readZodBody } from '~/server/utils/schemas'
import { exposeParticipantGames, participantGameLinksInclude } from '~/server/utils/participants'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, participantSchema)
  const { name, email, phone, notes, gameIds, published } = body
  const uniqueGameIds = [...new Set(gameIds)]

  const participant = await prisma.participant.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      gameLinks: {
        create: uniqueGameIds.map((gameId) => ({ gameId }))
      },
      published: published ?? true
    },
    include: participantGameLinksInclude
  })

  return exposeParticipantGames(participant)
})



