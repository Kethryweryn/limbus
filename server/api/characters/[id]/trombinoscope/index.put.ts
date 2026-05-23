import { requireOrganizer } from '~/server/utils/auth'
import { characterTrombinoscopeSchema, readZodBody } from '~/server/utils/schemas'
import { saveCharacterTrombinoscopeConfig } from '~/server/utils/trombinoscopes'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const body = await readZodBody(event, characterTrombinoscopeSchema)
  return await saveCharacterTrombinoscopeConfig(id, body.entries)
})
