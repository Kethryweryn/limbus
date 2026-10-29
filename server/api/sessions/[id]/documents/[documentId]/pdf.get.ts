import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { buildDocumentPdf } from '~/server/utils/documents'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const documentId = requireRouterParam(event, 'documentId')

  const session = await requireSessionAccess(event, id)

  const pdf = await buildDocumentPdf(session.id, documentId)
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${pdf.filename}"`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'no-store')

  return Buffer.from(pdf.bytes)
})
