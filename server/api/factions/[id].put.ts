import { requireUser } from '~/server/utils/auth'
import { readZodBody, factionSchema } from '~/server/utils/schemas'
import { requireRouterParam } from '~/server/utils/routeParams'
import { updateFaction } from '~/server/utils/contentWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/contentWrites.ts, US-126)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await updateFaction(event, requireRouterParam(event, 'id'), () => readZodBody(event, factionSchema))
})
