import { PrismaClient } from '@prisma/client'
import { getAuthUser } from '@/server/utils/auth'
import { generateSlug } from '@/server/utils/generateSlug'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = getAuthUser(event)
  if (!user || user.role !== 'organizer') {
    return sendError(event, createError({ statusCode: 403, statusMessage: 'Forbidden' }))
  }

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
