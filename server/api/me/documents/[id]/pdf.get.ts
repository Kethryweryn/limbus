import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { myDeliveryPdf, requireMyDelivery } from '~/server/utils/myDocuments'

// Le PDF d'un document reçu : celui joint à l'email tant que la copie existe (US-079, ADR-0044)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const delivery = await requireMyDelivery(user.id, requireRouterParam(event, 'id'))
  const pdf = await myDeliveryPdf(delivery)

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="${pdf.filename}"`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return Buffer.from(pdf.bytes)
})
