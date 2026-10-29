import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, sessionTimelineSchema } from '~/server/utils/schemas'
import { requireGameAccess, requireSessionAccess } from '~/server/utils/gameAccess'
import { SESSION_ROLES } from '~/utils/domain'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')

  const body = await readZodBody(event, sessionTimelineSchema)
  const accessibleSession = await requireSessionAccess(event, id)
  // Le déroulé fait partie de la version de la session (ADR-0028)
  await assertUnmodifiedSince(event, 'session', accessibleSession.id)
  const session = await prisma.session.findUnique({
    where: { id: accessibleSession.id },
    include: {
      participants: true
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, message: 'Session introuvable' })
  }
  await requireGameAccess(event, session.gameId)

  const timelineEventIds = [...new Set(body.assignments.map((assignment) => assignment.timelineEventId))]
  if (timelineEventIds.length) {
    const count = await prisma.timelineEvent.count({
      where: {
        id: { in: timelineEventIds },
        gameId: session.gameId
      }
    })
    if (count !== timelineEventIds.length) {
      throw createError({ statusCode: 400, message: 'Événements invalides pour cette session' })
    }
  }

  const eligibleParticipantIds = new Set(
    session.participants
      .filter((participant) => participant.role === SESSION_ROLES.organizer || participant.role === SESSION_ROLES.npc)
      .map((participant) => participant.participantId)
  )

  const createRows = body.assignments.flatMap((assignment) => {
    const participantIds = [...new Set(assignment.participantIds)]
    const invalidParticipantId = participantIds.find((participantId) => !eligibleParticipantIds.has(participantId))

    if (invalidParticipantId) {
      throw createError({
        statusCode: 400,
        message: 'Un responsable doit être organisateur ou PNJ de la session'
      })
    }

    return participantIds.map((participantId) => ({
      sessionId: session.id,
      timelineEventId: assignment.timelineEventId,
      participantId
    }))
  })

  const { updatedAt } = await prisma.$transaction(async (tx) => {
    await tx.timelineEventResponsible.deleteMany({
      where: { sessionId: session.id }
    })

    if (createRows.length) {
      await tx.timelineEventResponsible.createMany({
        data: createRows,
        skipDuplicates: true
      })
    }

    // Nouvelle version de la session, renvoyée pour l'enregistrement suivant
    return await tx.session.update({ where: { id: session.id }, data: { updatedAt: new Date() }, select: { updatedAt: true } })
  })

  return { ok: true, updatedAt }
})
