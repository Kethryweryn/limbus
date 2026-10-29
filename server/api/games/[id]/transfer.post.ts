import { requireUser } from '~/server/utils/auth'
import { proposeGameTransfer } from '~/server/utils/gameTransfers'
import { gameTransferSchema, readZodBody } from '~/server/utils/schemas'
import { requireRouterParam } from '~/server/utils/routeParams'

// La propriétaire propose son jeu à une co-organisatrice (US-060)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = requireRouterParam(event, 'id')
  const body = await readZodBody(event, gameTransferSchema)
  return await proposeGameTransfer(id, user.id, body.userId)
})
