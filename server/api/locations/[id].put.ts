import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { locationSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, locationSchema)
  const { name, address, notes, gameId, published } = body

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
