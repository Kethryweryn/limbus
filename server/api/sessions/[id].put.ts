import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, sessionSchema } from '~/server/utils/schemas'
import { requireGameAccess, requireSessionAccess, assertSameGame } from '~/server/utils/gameAccess'
import { assertSessionCastRules, assertSessionLocation, normalizeAssignments, normalizeSessionParticipants } from '~/server/utils/sessionAssignments'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { deleteUnusedUploads } from '~/server/utils/uploads'

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const existingSession = await requireSessionAccess(event, id)
  await assertUnmodifiedSince(event, 'session', existingSession.id)

  const body = await readZodBody(event, sessionSchema)
  const { name, gameId, locationId, status, published } = body
  assertSameGame(existingSession.gameId, gameId)
  await requireGameAccess(event, gameId)
  const assignments = normalizeAssignments(body.assignments)
  const participants = normalizeSessionParticipants(body.participants, assignments)
  await assertSessionCastRules(gameId, participants, assignments)
  await assertSessionLocation(gameId, locationId)

  // Photos remplacées ou retirées de la distribution : effacées si plus rien ne les utilise
  const previousPhotoUrls = (await prisma.sessionAssignment.findMany({
    where: { sessionId: existingSession.id },
    select: { photoUrl: true }
  })).map((assignment) => assignment.photoUrl)

  const session = await prisma.session.update({
    where: { id: existingSession.id },
    data: {
      name,
      slug: await generateUniqueSlug('session', name, existingSession.id),
      gameId,
      date: parseDate(body.date),
      locationId: locationId || null,
      status,
      published: published ?? true,
      participants: {
        deleteMany: {},
        create: participants
      },
      assignments: {
        deleteMany: {},
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

  await deleteUnusedUploads(previousPhotoUrls)
  return session
})
