import { labelSessions } from '~/server/utils/sessionLabels'
import { prisma } from '~/server/utils/prisma'
import { requireRouterParam } from '~/server/utils/routeParams'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { REGISTRATION_PERIOD_STATES, SESSION_STATUSES } from '~/utils/domain'
import { startOfDay } from '~/utils/registrationPeriods'

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
      updatedAt: true,
      publicShowSessions: true,
      publicShowRegistration: true,
      // Sessions à venir marquées visibles (US-086, SPEC-004 R2b) : date et lieu seulement
      sessions: {
        where: { published: true, status: SESSION_STATUSES.scheduled, OR: [{ date: null }, { date: { gte: startOfDay(new Date()) } }] },
        orderBy: { date: 'asc' },
        select: { id: true, date: true, location: { select: { name: true } } }
      },
      // Vivier ouvert : son lien de diffusion (US-086, R32)
      registrationPeriods: {
        where: { state: REGISTRATION_PERIOD_STATES.open },
        select: { publicId: true }
      }
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

  const { sessions, registrationPeriods, publicShowSessions, publicShowRegistration, ...presentation } = game
  return {
    ...presentation,
    // Libellé seulement, sans l'identifiant de la session (SPEC-021)
    upcomingSessions: publicShowSessions ? (await labelSessions(prisma, sessions)).map(({ id: _id, ...session }) => session) : [],
    registrationLinks: publicShowRegistration
      ? registrationPeriods.map((period) => ({ url: absoluteAppUrl(`/i/${period.publicId}`) }))
      : []
  }
})
