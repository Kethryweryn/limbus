const SERVER_UNAVAILABLE_KEY = 'limbusServerUnavailable'

export function isServerUnavailable() {
  if (!process.client) return false
  return sessionStorage.getItem(SERVER_UNAVAILABLE_KEY) === 'true'
}

export function setServerUnavailable(value: boolean) {
  if (!process.client) return

  const previousValue = isServerUnavailable()
  if (previousValue === value) return

  if (value) {
    sessionStorage.setItem(SERVER_UNAVAILABLE_KEY, 'true')
  } else {
    sessionStorage.removeItem(SERVER_UNAVAILABLE_KEY)
  }

  window.dispatchEvent(new CustomEvent('limbus:connection-change'))
}

export function isOfflineMode() {
  if (!process.client) return false
  return !navigator.onLine || isServerUnavailable()
}

export function getErrorStatus(error: any): number | undefined {
  return error?.statusCode || error?.status || error?.response?.status
}

export function isNetworkError(error: any) {
  const status = getErrorStatus(error)
  return !status && (
    error?.name === 'FetchError' ||
    error?.name === 'TypeError' ||
    error?.message?.toLowerCase().includes('fetch') ||
    error?.cause
  )
}

export function isServerUnavailableError(error: any) {
  const status = getErrorStatus(error)
  return isNetworkError(error) || status === 502 || status === 503 || status === 504
}
