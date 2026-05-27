import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds } from '~/server/utils/gameAccess'
import { participantSchema, readZodBody } from '~/server/utils/schemas'
import { exposeParticipantGames, participantGameLinksInclude } from '~/server/utils/participants'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }

  const body = await readZodBody(event, participantSchema)
  const { name, email, phone, notes, gameIds, published } = body
  const uniqueGameIds = [...new Set(gameIds)]
  const allowedGameIds = await accessibleGameIds(event)
  if (allowedGameIds !== null && uniqueGameIds.some((gameId) => !allowedGameIds.includes(gameId))) {
    throw createError({ statusCode: 403, message: 'Jeu inaccessible' })
  }

  await assertUnmodifiedSince(event, 'participant', id)

  const existingLinks = await prisma.participantGame.findMany({
    where: { participantId: id },
    select: { gameId: true }
  })
  const existingGameIds = new Set(existingLinks.map((link) => link.gameId))
  const nextGameIds = new Set(uniqueGameIds)
  const managedExistingGameIds = allowedGameIds === null
    ? existingLinks.map((link) => link.gameId)
    : existingLinks.map((link) => link.gameId).filter((gameId) => allowedGameIds.includes(gameId))

  const gameIdsToRemove = managedExistingGameIds.filter((gameId) => !nextGameIds.has(gameId))
  const gameIdsToAdd = uniqueGameIds.filter((gameId) => !existingGameIds.has(gameId))

  const participant = await prisma.participant.update({
    where: { id },
    data: {
      name,
      slug: await generateUniqueSlug('participant', name, id),
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      gameLinks: {
        deleteMany: gameIdsToRemove.map((gameId) => ({ gameId })),
        create: gameIdsToAdd.map((gameId) => ({ gameId }))
      },
      published: published ?? true
    },
    include: participantGameLinksInclude(allowedGameIds)
  })

  return exposeParticipantGames(participant)
})



