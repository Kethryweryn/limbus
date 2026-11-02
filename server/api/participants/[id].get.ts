import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readParticipant } from '~/server/utils/sheetReads'

// Par identifiant ; une page lit par slug (slug/[slug].get.ts)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await readParticipant(event, { id: requireRouterParam(event, 'id') })
})
