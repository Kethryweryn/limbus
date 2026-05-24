import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { markCharacterSheetBundleDeliveries } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireSessionAccess(event, id)

  const url = getRequestURL(event)
  return await markCharacterSheetBundleDeliveries(id, url.origin)
})
