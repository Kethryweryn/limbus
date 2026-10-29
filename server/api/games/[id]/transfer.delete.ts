import { requireUser } from '~/server/utils/auth'
import { cancelGameTransfer } from '~/server/utils/gameTransfers'
import { requireRouterParam } from '~/server/utils/routeParams'

// Retirer la proposition (la propriétaire) ou la refuser (la destinataire) (US-060)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await cancelGameTransfer(requireRouterParam(event, 'id'), user.id)
  return { success: true }
})
