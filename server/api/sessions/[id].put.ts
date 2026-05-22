import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, sessionSchema } from '~/server/utils/schemas'

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeAssignments(assignments: any[] | undefined) {
  if (!Array.isArray(assignments)) return []

  const seen = new Set<string>()
  const normalized = []

  for (const assignment of assignments) {
    if (!assignment.characterId || seen.has(assignment.characterId)) continue

    seen.add(assignment.characterId)
    normalized.push({
      characterId: assignment.characterId,
      playerId: assignment.playerId || null,
      photoUrl: assignment.photoUrl || null,
      notes: assignment.notes || null
    })
  }

  return normalized
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, sessionSchema)
  const { name, gameId, locationId, published } = body

  return await prisma.session.update({
    where: { id },
    data: {
      name,
      gameId,
      date: parseDate(body.date),
      locationId: locationId || null,
      published: published ?? true,
      assignments: {
        deleteMany: {},
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
