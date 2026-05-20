import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateSlug } from '@/server/utils/generateSlug'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readBody(event)
  const { title, description, teaserUrl, noteIntention } = body

  if (!title) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Title is required' }))
  }

  const slug = generateSlug(title)

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
