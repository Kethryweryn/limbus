// Origine des écritures (US-104, ADR-0053) : une écriture venue d'un autre site est refusée

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
// Le navigateur envoie seul les rapports CSP, et la route n'écrit qu'un compteur
const EXEMPT_PATHS = ['/api/public/csp-report']

type OriginHeaders = { secFetchSite?: string, origin?: string, referer?: string }

function originOf(url: string | undefined) {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Une requête doit-elle être vérifiée : écriture sous /api/, hors exceptions. */
export function isCheckedWrite(method: string, path: string) {
  const pathname = path.split('?')[0]!
  return WRITE_METHODS.includes(method.toUpperCase()) && pathname.startsWith('/api/') && !EXEMPT_PATHS.includes(pathname)
}

/**
 * L'écriture vient-elle de Limbus : `Sec-Fetch-Site` d'abord, sinon `Origin`, sinon `Referer`, comparés à l'origine
 * de l'application. Sans aucun indice, non.
 */
export function isSameOriginWrite(headers: OriginHeaders, appOrigin: string) {
  if (headers.secFetchSite) return headers.secFetchSite === 'same-origin' || headers.secFetchSite === 'none'
  const origin = headers.origin && headers.origin !== 'null' ? originOf(headers.origin) : originOf(headers.referer)
  return origin === appOrigin
}
