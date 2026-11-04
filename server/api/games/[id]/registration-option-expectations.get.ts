import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { currentOptionExpectations, optionExpectationsVersion } from '~/server/utils/registrationOptionExpectations'

// Proportions attendues des options (US-141, ADR-0062) : pour l'éditeur du formulaire, avec la version lue
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)

  const [expectations, version] = await Promise.all([currentOptionExpectations(gameId), optionExpectationsVersion(gameId)])
  return { expectations, version: version?.toISOString() ?? null }
})
