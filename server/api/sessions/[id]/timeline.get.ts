import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { timelineEventInclude, withTimelineConflicts } from '~/server/utils/timelineEvents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      game: true,
      participants: {
        include: {
          participant: true
        }
      }
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session introuvable' })
  }

  const [events, responsibles] = await Promise.all([
    prisma.timelineEvent.findMany({
      where: { gameId: session.gameId },
      orderBy: [{ day: 'asc' }, { time: 'asc' }, { name: 'asc' }],
      include: timelineEventInclude
    }),
    prisma.timelineEventResponsible.findMany({
      where: { sessionId: session.id },
      include: {
        participant: true
      }
    })
  ])

  type Responsible = (typeof responsibles)[number]
  const responsiblesByEventId = new Map<string, Responsible[]>()
  for (const responsible of responsibles) {
    const current = responsiblesByEventId.get(responsible.timelineEventId) || []
    current.push(responsible)
    responsiblesByEventId.set(responsible.timelineEventId, current)
  }

  return {
    session,
    events: withTimelineConflicts(events).map((timelineEvent) => ({
      ...timelineEvent,
      responsibles: responsiblesByEventId.get(timelineEvent.id) || []
    }))
  }
})
