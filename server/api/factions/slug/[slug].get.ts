import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readFaction } from '~/server/utils/sheetReads'

// Par slug, pour les pages ; l'API qui modifie ou relie utilise l'identifiant ([id].get.ts)
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await readFaction(event, { slug: requireRouterParam(event, 'slug') })
})
