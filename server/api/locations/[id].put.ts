import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { locationSchema, readZodBody } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }
  const location = await prisma.location.findUnique({ where: { id }, select: { gameId: true } })
  if (!location) {
    throw createError({ statusCode: 404, statusMessage: 'Lieu introuvable' })
  }
  await requireGameAccess(event, location.gameId)
  await assertUnmodifiedSince(event, 'location', id)

  const body = await readZodBody(event, locationSchema)
  const { name, address, notes, gameId, published } = body
  await requireGameAccess(event, gameId)

  return await prisma.location.update({
    where: { id },
    data: {
      name,
      address: address || null,
      notes: notes || null,
      gameId,
      published: published ?? true
    },
    include: {
      game: true
    }
  })
})
