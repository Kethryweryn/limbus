import { requireUser } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { gameAiAccess } from '~/server/utils/aiAccess'

// Assistants d'un jeu, vus par sa propriétaire (US-123) : réglage, autorisations, journal
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = requireRouterParam(event, 'id')
  await requireGameOwner(event, id)
  return await gameAiAccess(id)
})
