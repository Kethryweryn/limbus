import { requireOrganizer } from '~/server/utils/auth'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
  }

  const forwardedProto = getHeader(event, 'x-forwarded-proto')
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto
  const host = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host') || ''
  const fallbackProtocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  const publicBaseUrl = host ? `${protocol || fallbackProtocol}://${host}` : ''

  return await generateSessionTrombinoscopes(id, publicBaseUrl)
})
