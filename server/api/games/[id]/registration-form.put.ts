import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { readZodBody, registrationFormDefinitionSchema } from '~/server/utils/schemas'
import { saveRegistrationFormDefinition } from '~/server/utils/registrationForms'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const gameId = getRouterParam(event, 'id')
  if (!gameId) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireGameAccess(event, gameId)

  const definition = await readZodBody(event, registrationFormDefinitionSchema)
  return await saveRegistrationFormDefinition(gameId, definition)
})
