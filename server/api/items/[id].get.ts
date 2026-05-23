import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { itemInclude } from '~/server/utils/items'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const item = await prisma.item.findUnique({
    where: { id },
    include: itemInclude
  })

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Objet introuvable' })
  }

  return item
})
