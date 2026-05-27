import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const session = await requireSessionAccess(event, id)

  const forwardedProto = getHeader(event, 'x-forwarded-proto')
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto
  const host = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host') || ''
  const fallbackProtocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  const publicBaseUrl = host ? `${protocol || fallbackProtocol}://${host}` : ''

  return await generateSessionTrombinoscopes(session.id, publicBaseUrl)
})
