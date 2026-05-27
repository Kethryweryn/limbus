import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { locationSchema, readZodBody } from '~/server/utils/schemas'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const body = await readZodBody(event, locationSchema)
  const { name, address, notes, gameId, published } = body
  await requireGameAccess(event, gameId)

  return await prisma.location.create({
    data: {
      name,
      slug: await generateUniqueSlug('location', name),
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
