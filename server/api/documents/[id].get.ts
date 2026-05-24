import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { documentInclude } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }

  const document = await prisma.document.findFirst({
    where: await gameScopedWhere(event, { id }),
    include: documentInclude
  })

  if (!document) {
    throw createError({ statusCode: 404, message: 'Document introuvable' })
  }

  return document
})
