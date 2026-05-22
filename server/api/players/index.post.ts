import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { playerSchema, readZodBody } from '~/server/utils/schemas'
import { exposePlayerGames, playerGameLinksInclude } from '~/server/utils/players'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, playerSchema)
  const { name, email, phone, notes, gameIds, published } = body
  const uniqueGameIds = [...new Set(gameIds)]

  const player = await prisma.player.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      gameLinks: {
        create: uniqueGameIds.map((gameId) => ({ gameId }))
      },
      published: published ?? true
    },
    include: playerGameLinksInclude
  })

  return exposePlayerGames(player)
})
