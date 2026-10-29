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
    // Ancien slug d'un jeu renommé (US-045, ADR-0035) : le slug actuel, si le jeu a toujours sa page publique.
    // Sinon la même réponse qu'un jeu absent : rien n'apprend que le jeu a été renommé
    const redirect = await prisma.gameSlugRedirect.findUnique({
      where: { slug },
      select: { game: { select: { slug: true, published: true, publicPage: true } } }
    })
    if (redirect?.game.published && redirect.game.publicPage) {
      return { redirectSlug: redirect.game.slug }
    }
    throw createError({ statusCode: 404, message: 'Jeu non publié' })
  }

  return game
})
