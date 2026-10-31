import { prisma } from '~/server/utils/prisma'
import { requireRouterParam } from '~/server/utils/routeParams'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { REGISTRATION_ENTRY_MODES, REGISTRATION_PERIOD_STATES, SESSION_STATUSES } from '~/utils/domain'
import { effectivePeriodState } from '~/utils/registrationPeriods'

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
        where: { published: true, status: SESSION_STATUSES.scheduled, OR: [{ date: null }, { date: { gte: startOfToday() } }] },
        orderBy: { date: 'asc' },
        select: { name: true, date: true, location: { select: { name: true } } }
      },
      // Périodes ouvertes en mode formulaire : leur lien de diffusion (US-086, R32)
      registrationPeriods: {
        where: { entryMode: REGISTRATION_ENTRY_MODES.form, state: REGISTRATION_PERIOD_STATES.open },
        orderBy: { createdAt: 'asc' },
        select: { name: true, publicId: true, scope: true, state: true, closesAt: true }
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
    upcomingSessions: publicShowSessions ? sessions : [],
    registrationLinks: publicShowRegistration
      ? registrationPeriods
        .filter((period) => effectivePeriodState(period) === REGISTRATION_PERIOD_STATES.open)
        .map((period) => ({ name: period.name, permanent: period.scope === 'game', url: absoluteAppUrl(`/i/${period.publicId}`) }))
      : []
  }
})

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}
