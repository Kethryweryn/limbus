import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { readZodBody, registrationFormDefinitionSchema } from '~/server/utils/schemas'
import { saveRegistrationFormDefinition } from '~/server/utils/registrationForms'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const gameId = requireRouterParam(event, 'id')
  await requireGameAccess(event, gameId)

  const { baseVersionNumber, ...definition } = await readZodBody(event, registrationFormDefinitionSchema)
  return await saveRegistrationFormDefinition(gameId, definition, baseVersionNumber)
})
