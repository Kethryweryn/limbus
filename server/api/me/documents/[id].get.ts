import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readMyDelivery, requireMyDelivery } from '~/server/utils/myDocuments'

// Un document reçu, à lire dans la page (US-079, ADR-0044) : la copie envoyée, ou la version actuelle validée
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const delivery = await requireMyDelivery(user.id, requireRouterParam(event, 'id'))
  return await readMyDelivery(delivery)
})
