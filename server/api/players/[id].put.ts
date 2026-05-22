import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { playerSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, playerSchema)
  const { name, email, phone, notes, gameId, published } = body

  return await prisma.player.update({
    where: { id },
    data: {
      name,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      gameId,
      published: published ?? true
    },
    include: {
      game: true
    }
  })
})
