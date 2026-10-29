import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accessibleGameIds, requireParticipantAccess } from '~/server/utils/gameAccess'
import { participantSchema, readZodBody } from '~/server/utils/schemas'
import { exposeParticipantGames, participantGameLinksInclude, removeParticipantFromGames } from '~/server/utils/participants'
import { eraseParticipant } from '~/server/utils/participantPrivacy'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { requireRouterParam } from '~/server/utils/routeParams'
import { accountIdForEmail } from '~/server/utils/participantAccounts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const id = requireRouterParam(event, 'id')
  await requireParticipantAccess(event, id)

  const body = await readZodBody(event, participantSchema)
  const { name, email, phone, gameNotes, gameIds } = body
  const uniqueGameIds = [...new Set(gameIds)]
  const allowedGameIds = await accessibleGameIds(event)
  // Jeux liés et notes par jeu (US-069) : tous doivent être accessibles
  if (allowedGameIds !== null && [...uniqueGameIds, ...Object.keys(gameNotes)].some((gameId) => !allowedGameIds.includes(gameId))) {
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
      // Le rattachement suit l'adresse : autre compte, ou aucun (US-070)
      userId: await accountIdForEmail(email),
      gameLinks: {
        create: gameIdsToAdd.map((gameId) => ({ gameId, notes: gameNotes[gameId] || null })),
        // Note de chaque jeu déjà lié et reçu ; les notes des autres jeux ne bougent pas (US-069)
        updateMany: Object.entries(gameNotes)
          .filter(([gameId]) => existingGameIds.has(gameId) && nextGameIds.has(gameId))
          .map(([gameId, text]) => ({ where: { gameId }, data: { notes: text || null } }))
      }
    },
    include: participantGameLinksInclude(allowedGameIds)
  })

  return exposeParticipantGames(participant)
})



