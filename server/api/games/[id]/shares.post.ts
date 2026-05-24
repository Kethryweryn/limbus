import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { GAME_SHARE_ROLES } from '~/utils/domain'
import { gameShareSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  await requireGameOwner(event, id)

  const body = await readZodBody(event, gameShareSchema)
  const game = await prisma.game.findUnique({ where: { id }, select: { ownerId: true } })
  if (game?.ownerId === body.userId) {
    throw createError({ statusCode: 400, statusMessage: 'Le propriétaire a déjà accès au jeu' })
  }

  return await prisma.gameShare.upsert({
    where: {
      gameId_userId: {
        gameId: id,
        userId: body.userId
      }
    },
    update: {
      role: GAME_SHARE_ROLES.organizer
    },
    create: {
      gameId: id,
      userId: body.userId,
      role: GAME_SHARE_ROLES.organizer
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } }
    }
  })
})
