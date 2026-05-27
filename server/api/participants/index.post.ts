import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'
import { participantSchema, readZodBody } from '~/server/utils/schemas'
import { exposeParticipantGames, participantGameLinksInclude } from '~/server/utils/participants'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const body = await readZodBody(event, participantSchema)
  const { name, email, phone, notes, gameIds, published } = body
  const uniqueGameIds = [...new Set(gameIds)]
  const allowedGameIds = await accessibleGameIds(event)
  if (allowedGameIds !== null && uniqueGameIds.some((gameId) => !allowedGameIds.includes(gameId))) {
    throw createError({ statusCode: 403, message: 'Jeu inaccessible' })
  }

  const participant = await prisma.participant.create({
    data: {
      name,
      slug: await generateUniqueSlug('participant', name),
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      gameLinks: {
        create: uniqueGameIds.map((gameId) => ({ gameId }))
      },
      published: published ?? true
    },
    include: participantGameLinksInclude(allowedGameIds)
  })

  return exposeParticipantGames(participant)
})



