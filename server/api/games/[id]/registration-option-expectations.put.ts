import { requireUser } from '~/server/utils/auth'
import { assertVersion } from '~/server/utils/concurrency'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { currentOptionExpectations, optionExpectationsVersion, saveOptionExpectations } from '~/server/utils/registrationOptionExpectations'
import { readZodBody, registrationOptionExpectationsSchema } from '~/server/utils/schemas'

// Remplace les proportions attendues des options (US-141, ADR-0062) : hors des versions du formulaire. La version porte sur
// toutes les lignes du jeu, d'où assertVersion
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)
  const body = await readZodBody(event, registrationOptionExpectationsSchema)

  assertVersion(event, await optionExpectationsVersion(gameId))
  await saveOptionExpectations(gameId, body.expectations)

  const [expectations, version] = await Promise.all([currentOptionExpectations(gameId), optionExpectationsVersion(gameId)])
  return { expectations, version: version?.toISOString() ?? null }
})
