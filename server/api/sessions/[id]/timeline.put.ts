import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, sessionTimelineSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, sessionTimelineSchema)
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      participants: true
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session introuvable' })
  }

  const timelineEventIds = [...new Set(body.assignments.map((assignment) => assignment.timelineEventId))]
  if (timelineEventIds.length) {
    const count = await prisma.timelineEvent.count({
      where: {
        id: { in: timelineEventIds },
        gameId: session.gameId
      }
    })
    if (count !== timelineEventIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Événements invalides pour cette session' })
    }
  }

  const eligibleParticipantIds = new Set(
    session.participants
      .filter((participant) => participant.role === 'organizer' || participant.role === 'npc')
      .map((participant) => participant.participantId)
  )

  const createRows = body.assignments.flatMap((assignment) => {
    const participantIds = [...new Set(assignment.participantIds)]
    const invalidParticipantId = participantIds.find((participantId) => !eligibleParticipantIds.has(participantId))

    if (invalidParticipantId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Un responsable doit être organisateur ou PNJ de la session'
      })
    }

    return participantIds.map((participantId) => ({
      sessionId: session.id,
      timelineEventId: assignment.timelineEventId,
      participantId
    }))
  })

  await prisma.$transaction(async (tx) => {
    await tx.timelineEventResponsible.deleteMany({
      where: { sessionId: session.id }
    })

    if (createRows.length) {
      await tx.timelineEventResponsible.createMany({
        data: createRows,
        skipDuplicates: true
      })
    }
  })

  return { ok: true }
})
