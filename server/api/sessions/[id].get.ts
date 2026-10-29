import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const idOrSlug = requireRouterParam(event, 'id')

  const session = await prisma.session.findFirst({
    where: await gameScopedWhere(event, {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    }),
    include: {
      game: true,
      location: true,
      // Report (US-022) : session de destination et d'origine
      postponedTo: { select: { id: true, slug: true, name: true, date: true } },
      postponedFrom: { select: { id: true, slug: true, name: true, date: true } },
      participants: {
        include: {
          participant: true
        }
      },
      assignments: {
        include: {
          character: true,
          participant: true
        },
        orderBy: {
          characterId: 'asc'
        }
      }
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, message: 'Session introuvable' })
  }

  return session
})
