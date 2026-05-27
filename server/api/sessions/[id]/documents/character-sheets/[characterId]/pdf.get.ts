import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { buildCharacterSheetPdf } from '~/server/utils/documents'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const characterId = getRouterParam(event, 'characterId')
  if (!id || !characterId) {
    throw createError({ statusCode: 400, message: 'Paramètres manquants' })
  }

  const session = await requireSessionAccess(event, id)

  const pdf = await buildCharacterSheetPdf(session.id, characterId)
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${pdf.filename}"`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'no-store')

  return Buffer.from(pdf.bytes)
})
