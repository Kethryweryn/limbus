import { requireUser } from '~/server/utils/auth'
import { readZodBody, sessionTimelineSchema } from '~/server/utils/schemas'
import { requireRouterParam } from '~/server/utils/routeParams'
import { updateSessionTimeline } from '~/server/utils/sessionWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/sessionWrites.ts, US-128)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await updateSessionTimeline(event, requireRouterParam(event, 'id'), () => readZodBody(event, sessionTimelineSchema))
})
