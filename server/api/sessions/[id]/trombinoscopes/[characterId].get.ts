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
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${trombinoscope.fileName}"`)

  return trombinoscope.contentHtml
})
