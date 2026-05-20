import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { generateSlug } from '~/server/utils/generateSlug'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'ID manquant' }))
  }

  const body = await readBody(event)
  const { title, description, teaserUrl, noteIntention, published } = body

  const data: any = {
    description,
    teaserUrl,
    noteIntention,
    published
  }

  if (title) {
    data.title = title
    data.slug = generateSlug(title)
  }

  const game = await prisma.game.update({
    where: { id },
    data
  })

  return game
})
