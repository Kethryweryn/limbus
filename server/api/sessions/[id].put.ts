import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, sessionSchema } from '~/server/utils/schemas'
import { assertPlayersRegisteredForGame, normalizeAssignments } from '~/server/utils/sessionAssignments'

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, sessionSchema)
  const { name, gameId, locationId, published } = body
  const assignments = normalizeAssignments(body.assignments)
  await assertPlayersRegisteredForGame(gameId, assignments)

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
        create: assignments
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
