import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { buildDocumentPdf } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const documentId = getRouterParam(event, 'documentId')
  if (!id || !documentId) {
    throw createError({ statusCode: 400, message: 'Paramètres manquants' })
  }

  const session = await requireSessionAccess(event, id)

  const pdf = await buildDocumentPdf(session.id, documentId)
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${pdf.filename}"`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'no-store')

  return Buffer.from(pdf.bytes)
})
