import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug manquant' })
  }

  const game = await prisma.game.findFirst({
    where: {
      slug,
      published: true,
      publicPage: true
    },
    select: {
      title: true,
      description: true,
      noteIntention: true,
      teaserUrl: true,
      slug: true,
      updatedAt: true
    }
  })

  if (!game) {
    throw createError({ statusCode: 404, statusMessage: 'Jeu non publié' })
  }

  return game
})
