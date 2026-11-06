import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { cancelDraw } from '~/server/utils/registrationDraws'

// Annuler un tirage tant que rien n'en est annoncé (US-094) : ses personnes repartent pré-inscrites
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const id = getRouterParam(event, 'id')
  const draw = id ? await prisma.registrationDraw.findUnique({ where: { id }, select: { id: true, period: { select: { gameId: true } } } }) : null
  if (!draw) {
    throw createError({ statusCode: 404, message: 'Tirage introuvable' })
  }
  await requireGameAccess(event, draw.period.gameId)

  return await cancelDraw(draw.id, user)
})
