import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { locationSchema, readZodBody } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const location = await prisma.location.findUnique({ where: { id }, select: { gameId: true } })
  if (!location) {
    throw createError({ statusCode: 404, message: 'Lieu introuvable' })
  }
  await requireGameAccess(event, location.gameId)
  await assertUnmodifiedSince(event, 'location', id)

  const body = await readZodBody(event, locationSchema)
  const { name, address, notes, gameId, published } = body
  await requireGameAccess(event, gameId)

  return await prisma.location.update({
    where: { id },
    data: {
      name,
      slug: await generateUniqueSlug('location', name, id),
      address: address || null,
      notes: notes || null,
      gameId,
      published: published ?? true
    },
    include: {
      game: true
    }
  })
})
