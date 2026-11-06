import type { H3Event } from 'h3'
import type { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requireCurrentUser, requireGameAccess, requireSessionAccess, assertSameGame } from '~/server/utils/gameAccess'
import { selectionTarget, writeSelection } from '~/server/utils/registrationSelection'
import { assertPlayersFromPool, assertSessionCastRules, assertSessionLocation, castAssignmentInclude, normalizeAssignments, normalizeSessionParticipants, resolveCastLines, withCastReservations } from '~/server/utils/sessionAssignments'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { assertGameUploads, deleteUnusedUploads } from '~/server/utils/uploads'
import type { sessionSchema, sessionTimelineSchema } from '~/server/utils/schemas'
import { SESSION_ROLES, SESSION_STATUSES } from '~/utils/domain'

// Écritures d'une session, communes aux routes de l'interface et aux outils des assistants d'IA (US-127, US-128,
// SPEC-014 R12) : mêmes contrôles d'accès, de version, de références du même jeu et de photos. Le corps validé est lu
// par `readBody` à la place qu'il a dans chaque route

type Reader<S extends z.ZodType> = () => Promise<z.output<S>>

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function createSession(event: H3Event, readBody: Reader<typeof sessionSchema>) {
  const body = await readBody()
  const { name, gameId, locationId, status, published } = body
  await requireGameAccess(event, gameId)
  const { lines: assignments } = await resolveCastLines(gameId, null, normalizeAssignments(body.assignments))
  const participants = normalizeSessionParticipants(body.participants, assignments)
  await assertSessionCastRules(gameId, participants, assignments)
  await assertPlayersFromPool(gameId, null, participants)
  await assertSessionLocation(gameId, locationId)
  await assertGameUploads(assignments.map((assignment) => assignment.photoUrl), gameId, { sessionFiles: true, label: 'Photo d’attribution' })

  return await prisma.session.create({
    data: {
      name,
      slug: await generateUniqueSlug('session', name),
      gameId,
      date: parseDate(body.date),
      locationId: locationId || null,
      status,
      cancelledAt: status === SESSION_STATUSES.cancelled ? new Date() : null,
      published: published ?? false,
      participants: {
        create: participants
      },
      assignments: {
        create: assignments
      }
    },
    include: {
      game: true,
      location: true,
      participants: {
        include: {
          participant: true
        }
      },
      assignments: {
        include: {
          character: true,
          participant: true
        }
      }
    }
  })
}

export async function updateSession(event: H3Event, id: string, readBody: Reader<typeof sessionSchema>) {
  const existingSession = await requireSessionAccess(event, id)
  await assertUnmodifiedSince(event, 'session', existingSession.id)

  const body = await readBody()
  const { name, gameId, locationId, status, published } = body
  assertSameGame(existingSession.gameId, gameId)
  await requireGameAccess(event, gameId)
  const { lines: assignments, reservedParticipants, toRetain } = await resolveCastLines(gameId, existingSession.id, normalizeAssignments(body.assignments))
  const participants = normalizeSessionParticipants(body.participants, assignments)
  await assertSessionCastRules(gameId, participants, assignments, reservedParticipants)
  await assertPlayersFromPool(gameId, existingSession.id, participants)
  await assertSessionLocation(gameId, locationId)

  // Photos remplacées ou retirées de la distribution : effacées si plus rien ne les utilise
  const previousPhotoUrls = (await prisma.sessionAssignment.findMany({
    where: { sessionId: existingSession.id },
    select: { photoUrl: true }
  })).map((assignment) => assignment.photoUrl)
  await assertGameUploads(assignments.map((assignment) => assignment.photoUrl), gameId, { sessionFiles: true, keep: previousPhotoUrls, label: 'Photo d’attribution' })

  // Date d'annulation, gardée tant que la session reste annulée (US-080) : relue seulement pour une session annulée
  const cancelledAt = status === SESSION_STATUSES.cancelled
    ? (await prisma.session.findUniqueOrThrow({ where: { id: existingSession.id }, select: { cancelledAt: true } })).cancelledAt ?? new Date()
    : null
  // Une personne du vivier choisie dans le cast est retenue en même temps que son personnage lui est réservé (R20)
  const retained = await Promise.all(toRetain.map((registrationId) => selectionTarget(registrationId, existingSession.id)))
  const author = retained.length ? await requireCurrentUser(event) : null
  const session = await prisma.$transaction(async (tx) => {
    for (const target of retained) await writeSelection(tx, target, 'retain', author!)
    return await tx.session.update({
      where: { id: existingSession.id },
      data: {
        name,
        slug: await generateUniqueSlug('session', name, existingSession.id),
        gameId,
        date: parseDate(body.date),
        locationId: locationId || null,
        status,
        cancelledAt,
        // Absent : la visibilité ne change pas (US-019)
        published,
        participants: {
          deleteMany: {},
          create: participants
        },
        assignments: {
          deleteMany: {},
          create: assignments
        }
      },
      // Comme la lecture de la session : la page la remplace par cette réponse, report compris (US-022)
      include: {
        game: true,
        location: true,
        postponedTo: { select: { id: true, slug: true, name: true, date: true } },
        postponedFrom: { select: { id: true, slug: true, name: true, date: true } },
        participants: {
          include: {
            participant: true
          }
        },
        assignments: {
          include: castAssignmentInclude
        }
      }
    })
  })

  // Responsables du déroulé : seulement des orgas et PNJ de l'équipe ; une personne qui en sort, ou change de rôle,
  // n'y reste pas (US-128)
  const responsibleIds = participants
    .filter((participant) => participant.role === SESSION_ROLES.organizer || participant.role === SESSION_ROLES.npc)
    .map((participant) => participant.participantId)
  await prisma.timelineEventResponsible.deleteMany({ where: { sessionId: existingSession.id, participantId: { notIn: responsibleIds } } })

  // Une session sans date ne peut pas rester ouverte à la pré-inscription (R6)
  if (!session.date) await prisma.registrationPeriodSession.updateMany({ where: { sessionId: session.id, open: true }, data: { open: false } })

  await deleteUnusedUploads(previousPhotoUrls)
  return await withCastReservations(session)
}

export async function updateSessionTimeline(event: H3Event, id: string, readBody: Reader<typeof sessionTimelineSchema>) {
  const body = await readBody()
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
}
