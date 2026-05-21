import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readBody(event)
  const { name, email, phone, notes, gameId, published } = body

  if (!name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  if (!gameId) {
    throw createError({ statusCode: 400, statusMessage: 'Game is required' })
  }

  return await prisma.player.create({
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
