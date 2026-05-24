import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { itemInclude } from '~/server/utils/items'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }

  const item = await prisma.item.findFirst({
    where: await gameScopedWhere(event, { id }),
    include: itemInclude
  })

  if (!item) {
    throw createError({ statusCode: 404, message: 'Objet introuvable' })
  }

  return item
})
