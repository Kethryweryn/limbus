import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { myDeliveryPhoto, requireMyDelivery } from '~/server/utils/myDocuments'

// Photo d'une carte d'un trombinoscope reçu (US-079, ADR-0044)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const delivery = await requireMyDelivery(user.id, requireRouterParam(event, 'id'))
  const index = Number(requireRouterParam(event, 'index'))
  if (!Number.isInteger(index) || index < 0) {
    throw createError({ statusCode: 404, message: 'Photo introuvable' })
  }
  const photo = await myDeliveryPhoto(delivery, index)

  setHeader(event, 'Content-Type', photo.contentType)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return Buffer.from(photo.bytes)
})
