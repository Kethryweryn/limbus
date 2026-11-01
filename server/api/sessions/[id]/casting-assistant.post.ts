import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { castingAssistantSchema, readZodBody } from '~/server/utils/schemas'
import { sessionCastingAssistant } from '~/server/utils/castingAssistant'

// Assistant de casting (US-101, US-102) : notes, interdits et proposition sur le cast en cours d'édition, sans rien écrire
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const session = await requireSessionAccess(event, requireRouterParam(event, 'id'))
  const { assignments } = await readZodBody(event, castingAssistantSchema)
  return await sessionCastingAssistant(session, assignments)
})
