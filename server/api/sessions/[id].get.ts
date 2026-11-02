import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readSession } from '~/server/utils/sheetReads'

// Par identifiant ; une page lit par slug (slug/[slug].get.ts)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await readSession(event, { id: requireRouterParam(event, 'id') })
})
