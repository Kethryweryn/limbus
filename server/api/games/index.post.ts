import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { createGameSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, createGameSchema)
  const { title, description, teaserUrl, noteIntention } = body

  const slug = await generateUniqueSlug('game', title)

  const game = await prisma.game.create({
    data: {
      title,
      slug,
      description,
      teaserUrl,
      noteIntention
    }
  })

  return game
})
