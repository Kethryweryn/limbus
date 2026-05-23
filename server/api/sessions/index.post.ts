import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, sessionSchema } from '~/server/utils/schemas'
import { assertSessionCastRules, normalizeAssignments, normalizeSessionParticipants } from '~/server/utils/sessionAssignments'

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readZodBody(event, sessionSchema)
  const { name, gameId, locationId, status, published } = body
  const assignments = normalizeAssignments(body.assignments)
  const participants = normalizeSessionParticipants(body.participants, assignments)
  await assertSessionCastRules(gameId, participants, assignments)

  return await prisma.session.create({
    data: {
      name,
      gameId,
      date: parseDate(body.date),
      locationId: locationId || null,
      status,
      published: published ?? true,
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
})
