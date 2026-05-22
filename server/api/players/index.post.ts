import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { playerSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, playerSchema)
  const { name, email, phone, notes, gameId, published } = body

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
