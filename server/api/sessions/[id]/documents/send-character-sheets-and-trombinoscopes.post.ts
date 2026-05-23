import { requireOrganizer } from '~/server/utils/auth'
import { markCharacterSheetBundleDeliveries } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  return await markCharacterSheetBundleDeliveries(id)
})
