import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'
import { participantCreateSchema, readZodBody } from '~/server/utils/schemas'
import { assertNotesForAllowedGames, exposeParticipantGames, participantGameLinksInclude } from '~/server/utils/participants'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const body = await readZodBody(event, participantCreateSchema)
  const { name, email, phone, gameNotes, gameIds } = body
  const uniqueGameIds = [...new Set(gameIds)]
  const allowedGameIds = await accessibleGameIds(event)
  if (allowedGameIds !== null && uniqueGameIds.some((gameId) => !allowedGameIds.includes(gameId))) {
    throw createError({ statusCode: 403, message: 'Jeu inaccessible' })
  }
  assertNotesForAllowedGames(gameNotes, allowedGameIds)

  const participant = await prisma.participant.create({
    data: {
      name,
      slug: await generateUniqueSlug('participant', name),
      email: email || null,
      phone: phone || null,
      gameLinks: {
        create: uniqueGameIds.map((gameId) => ({ gameId, notes: gameNotes[gameId] || null }))
      }
    },
    include: participantGameLinksInclude(allowedGameIds)
  })

  return exposeParticipantGames(participant)
})



