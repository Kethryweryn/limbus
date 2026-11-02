import { requireUser } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { readLocation } from '~/server/utils/sheetReads'

// Lecture explicite par slug, pour la page de la fiche ; l'API qui modifie utilise l'identifiant
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return await readLocation(event, { slug: requireRouterParam(event, 'slug') })
})
