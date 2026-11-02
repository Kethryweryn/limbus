import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { deleteDocument } from '~/server/utils/contentWrites'

// Écriture commune à l'interface et aux assistants d'IA (server/utils/contentWrites.ts, US-126)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await deleteDocument(event, requireRouterParam(event, 'id'))
})
