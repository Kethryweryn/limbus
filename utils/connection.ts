const SERVER_UNAVAILABLE_KEY = 'limbusServerUnavailable'

export function isServerUnavailable() {
  if (!import.meta.client) return false
  return sessionStorage.getItem(SERVER_UNAVAILABLE_KEY) === 'true'
}

export function setServerUnavailable(value: boolean) {
  if (!import.meta.client) return

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
  if (!import.meta.client) return false
  return !navigator.onLine || isServerUnavailable()
}

// Erreur d'un appel ($fetch, fetch) : les champs utiles, quand ils sont là
type FetchFailure = { statusCode?: number, status?: number, response?: { status?: number }, name?: string, message?: string, cause?: unknown } | null | undefined

export function getErrorStatus(error: unknown): number | undefined {
  const value = error as FetchFailure
  return value?.statusCode || value?.status || value?.response?.status
}

export function isNetworkError(error: unknown) {
  const status = getErrorStatus(error)
  const value = error as FetchFailure
  return !status && Boolean(
    value?.name === 'FetchError' ||
    value?.name === 'TypeError' ||
    value?.message?.toLowerCase().includes('fetch') ||
    value?.cause
  )
}

export function isServerUnavailableError(error: unknown) {
  const status = getErrorStatus(error)
  return isNetworkError(error) || status === 502 || status === 503 || status === 504
}

// Page jamais lue avec le réseau sur cet appareil (US-047) : useApiFetch le signale, useAsyncData le range sous cause
export function isOfflineMissing(error: unknown) {
  const value = error as { offlineMissing?: boolean, cause?: { offlineMissing?: boolean } } | null
  return Boolean(value?.offlineMissing || value?.cause?.offlineMissing)
}
