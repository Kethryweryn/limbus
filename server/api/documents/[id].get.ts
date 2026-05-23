import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { documentInclude } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    include: documentInclude
  })

  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document introuvable' })
  }

  return document
})
