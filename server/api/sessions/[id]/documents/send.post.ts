import { requireOrganizer } from '~/server/utils/auth'
import { readZodBody, sessionDocumentSendSchema } from '~/server/utils/schemas'
import { markDocumentDeliveries } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, sessionDocumentSendSchema)
  return await markDocumentDeliveries(id, body.documentIds)
})
