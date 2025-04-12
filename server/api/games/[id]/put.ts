import { prisma } from '~/server/utils/prisma'
import { getAuthUser } from '@/server/utils/auth'
import { generateSlug } from '~/server/utils/generateSlug'

export default defineEventHandler(async (event) => {
  const user = getAuthUser(event)
  if (!user || user.role !== 'organizer') {
    return sendError(event, createError({ statusCode: 403, statusMessage: 'Forbidden' }))
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'ID manquant' }))
  }
  const body = await readBody(event)
  const { title, description, teaserUrl, noteIntention, published } = body

  const slug = generateSlug(title)

  const game = await prisma.game.update({
    where: { id },
    data: {
      title,
      description,
      teaserUrl,
      noteIntention,
      slug,
      published
    }
  })

  return game
})
