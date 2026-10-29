import { prisma } from '~/server/utils/prisma'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  const slug = requireRouterParam(event, 'slug')

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
      // Crédit d'une copie léguée, comme sur sa fiche (US-044)
      creditSourceTitle: true,
      creditAuthorName: true,
      slug: true,
      updatedAt: true
    }
  })

  if (!game) {
    throw createError({ statusCode: 404, message: 'Jeu non publié' })
  }

  return game
})
