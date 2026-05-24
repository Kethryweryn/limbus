import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { readZodBody, sessionDocumentSendSchema } from '~/server/utils/schemas'
import { markDocumentDeliveries } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireSessionAccess(event, id)

  const body = await readZodBody(event, sessionDocumentSendSchema)
  return await markDocumentDeliveries(id, body.documentIds)
})
