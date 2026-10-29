import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { documentInclude } from '~/server/utils/documents'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')

  const document = await prisma.document.findFirst({
    where: await gameScopedWhere(event, {
      OR: [
        { id },
        { slug: id }
      ]
    }),
    include: documentInclude
  })

  if (!document) {
    throw createError({ statusCode: 404, message: 'Document introuvable' })
  }

  return document
})
