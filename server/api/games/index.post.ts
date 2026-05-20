import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readBody(event)
  const { title, description, teaserUrl, noteIntention } = body

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required' })
  }

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
