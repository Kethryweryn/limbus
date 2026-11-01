import { publicAppUrl } from '~/server/utils/appUrl'
import { isCheckedWrite, isSameOriginWrite } from '~/server/utils/requestOrigin'

// Refuse les écritures venues d'un autre site, connexion comprise (US-104, ADR-0053)
export default defineEventHandler((event) => {
  if (!isCheckedWrite(event.method, event.path)) return
  const allowed = isSameOriginWrite({
    secFetchSite: getHeader(event, 'sec-fetch-site'),
    origin: getHeader(event, 'origin'),
    referer: getHeader(event, 'referer')
  }, new URL(publicAppUrl()).origin)
  if (!allowed) {
    throw createError({ statusCode: 403, message: 'Requête refusée : elle ne vient pas de Limbus.' })
  }
})
