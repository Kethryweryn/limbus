import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { getSessionTrombinoscope } from '~/server/utils/trombinoscopes'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const characterId = getRouterParam(event, 'characterId')
  if (!id || !characterId) {
    throw createError({ statusCode: 400, message: 'Paramètres manquants' })
  }
  const session = await requireSessionAccess(event, id)

  const trombinoscope = await getSessionTrombinoscope(session.id, characterId)
  if (!trombinoscope.contentPdfBase64) {
    throw createError({ statusCode: 404, message: 'PDF non généré' })
  }

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${trombinoscope.fileName}"`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'no-store')

  return Buffer.from(trombinoscope.contentPdfBase64, 'base64')
})
