import { requireOrganizer } from '~/server/utils/auth'
import { getSessionTrombinoscope } from '~/server/utils/trombinoscopes'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const characterId = getRouterParam(event, 'characterId')
  if (!id || !characterId) {
    throw createError({ statusCode: 400, statusMessage: 'Paramètres manquants' })
  }

  const trombinoscope = await getSessionTrombinoscope(id, characterId)
  if (!trombinoscope.contentPdfBase64) {
    throw createError({ statusCode: 404, statusMessage: 'PDF non généré' })
  }

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${trombinoscope.fileName}"`)

  return Buffer.from(trombinoscope.contentPdfBase64, 'base64')
})
