import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { getAllergySheetForDisplay } from '~/server/utils/allergies'

// Fiche allergies de la session, construite à la demande (US-008) : données de santé, jamais mises en cache
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const session = await requireSessionAccess(event, getRouterParam(event, 'id') || '')
  setHeader(event, 'cache-control', 'private, no-store')
  return await getAllergySheetForDisplay(session.id)
})
