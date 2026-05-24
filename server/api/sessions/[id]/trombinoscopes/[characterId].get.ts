import { requireOrganizer } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { getSessionTrombinoscope } from '~/server/utils/trombinoscopes'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const characterId = getRouterParam(event, 'characterId')
  if (!id || !characterId) {
    throw createError({ statusCode: 400, message: 'Paramètres manquants' })
  }
  const session = await prisma.session.findUnique({ where: { id }, select: { gameId: true } })
  if (!session) {
    throw createError({ statusCode: 404, message: 'Session introuvable' })
  }
  await requireGameAccess(event, session.gameId)

  const trombinoscope = await getSessionTrombinoscope(id, characterId)
  if (!trombinoscope.contentPdfBase64) {
    throw createError({ statusCode: 404, message: 'PDF non généré' })
  }

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${trombinoscope.fileName}"`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'no-store')

  return Buffer.from(trombinoscope.contentPdfBase64, 'base64')
})
