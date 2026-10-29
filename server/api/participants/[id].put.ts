import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { accessibleGameIds, requireParticipantAccess } from '~/server/utils/gameAccess'
import { participantSchema, readZodBody } from '~/server/utils/schemas'
import { exposeParticipantGames, participantGameLinksInclude, removeParticipantFromGames } from '~/server/utils/participants'
import { eraseParticipant } from '~/server/utils/participantPrivacy'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  const user = await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  await requireParticipantAccess(event, id)

  const body = await readZodBody(event, participantSchema)
  const { name, email, phone, notes, gameIds } = body
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

  // Retirer un jeu retire aussi la personne de ses sessions (US-035)
  await removeParticipantFromGames(id, gameIdsToRemove, user)

  // Une fiche sans aucun jeu est supprimée (US-036) : l'interface l'a fait confirmer
  if (!gameIdsToAdd.length && !await prisma.participantGame.count({ where: { participantId: id } })) {
    await eraseParticipant(id)
    return { deleted: true }
  }

  const participant = await prisma.participant.update({
    where: { id },
    data: {
      name,
      slug: await generateUniqueSlug('participant', name, id),
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      gameLinks: {
        create: gameIdsToAdd.map((gameId) => ({ gameId }))
      }
    },
    include: participantGameLinksInclude(allowedGameIds)
  })

  return exposeParticipantGames(participant)
})



