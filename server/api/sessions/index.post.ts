import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeAssignments(assignments: any[] | undefined) {
  if (!Array.isArray(assignments)) return []

  const seen = new Set<string>()
  return assignments
    .filter((assignment) => assignment?.characterId && !seen.has(assignment.characterId))
    .map((assignment) => {
      seen.add(assignment.characterId)
      return {
        characterId: assignment.characterId,
        playerId: assignment.playerId || null,
        photoUrl: assignment.photoUrl || null,
        notes: assignment.notes || null
      }
    })
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const body = await readBody(event)
  const { name, gameId, locationId, published } = body

  if (!name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  if (!gameId) {
    throw createError({ statusCode: 400, statusMessage: 'Game is required' })
  }

  return await prisma.session.create({
    data: {
      name,
      gameId,
      date: parseDate(body.date),
      locationId: locationId || null,
      published: published ?? true,
      assignments: {
        create: normalizeAssignments(body.assignments)
      }
    },
    include: {
      game: true,
      location: true,
      assignments: {
        include: {
          character: true,
          player: true
        }
      }
    }
  })
})
