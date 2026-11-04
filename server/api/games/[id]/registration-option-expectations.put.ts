import { requireUser } from '~/server/utils/auth'
import { assertRowsVersion } from '~/server/utils/concurrency'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { optionExpectationsVersion, saveOptionExpectations } from '~/server/utils/registrationOptionExpectations'
import { readZodBody, registrationOptionExpectationsSchema } from '~/server/utils/schemas'

// Remplace les proportions attendues des options (US-141, ADR-0062) : hors des versions du formulaire
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)
  const body = await readZodBody(event, registrationOptionExpectationsSchema)

  assertRowsVersion(event, await optionExpectationsVersion(gameId))
  return await saveOptionExpectations(gameId, body.expectations)
})
