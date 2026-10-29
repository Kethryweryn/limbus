import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { getSessionTrombinoscope } from '~/server/utils/trombinoscopes'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const characterId = requireRouterParam(event, 'characterId')
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
