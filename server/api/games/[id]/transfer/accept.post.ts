import { requireUser } from '~/server/utils/auth'
import { acceptGameTransfer } from '~/server/utils/gameTransfers'
import { requireRouterParam } from '~/server/utils/routeParams'

// La destinataire accepte : elle devient propriétaire (US-060)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return await acceptGameTransfer(requireRouterParam(event, 'id'), user.id)
})
