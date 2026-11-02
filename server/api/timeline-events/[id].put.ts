import { requireUser } from '~/server/utils/auth'
import { readZodBody, timelineEventSchema } from '~/server/utils/schemas'
import { requireRouterParam } from '~/server/utils/routeParams'
import { updateTimelineEvent } from '~/server/utils/contentWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/contentWrites.ts, US-126)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await updateTimelineEvent(event, requireRouterParam(event, 'id'), () => readZodBody(event, timelineEventSchema))
})
