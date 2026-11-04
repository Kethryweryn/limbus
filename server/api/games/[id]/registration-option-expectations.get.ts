import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { optionExpectationsState } from '~/server/utils/registrationOptionExpectations'

// Proportions attendues des options (US-141, ADR-0062) : pour l'éditeur du formulaire, avec la version lue
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)

  return await optionExpectationsState(gameId)
})
