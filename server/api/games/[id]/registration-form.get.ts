import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const gameId = getRouterParam(event, 'id')
  if (!gameId) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireGameAccess(event, gameId)

  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { title: true, noteIntention: true } })
  if (!game) {
    throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  }
  return { ...await getCurrentRegistrationForm(gameId), game }
})
