import { requireUser } from '~/server/utils/auth'
import { timelineEventSchema, readZodBody } from '~/server/utils/schemas'
import { createTimelineEvent } from '~/server/utils/contentWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/contentWrites.ts, US-126)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await createTimelineEvent(event, () => readZodBody(event, timelineEventSchema))
})
