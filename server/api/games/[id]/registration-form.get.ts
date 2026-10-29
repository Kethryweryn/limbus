import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)

  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { title: true, noteIntention: true } })
  if (!game) {
    throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  }
  return { ...await getCurrentRegistrationForm(gameId), game }
})
