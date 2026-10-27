import { getErrorStatus, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'
import { enqueueOfflineOperation, isQueueableApiWrite } from '~/utils/offlineSync'

export function handleApiAuthError(error: any): void {
  const status = getErrorStatus(error)
  if (!import.meta.client || (status !== 401 && status !== 403)) return

  localStorage.removeItem('offlineAuth')
  window.location.reload()
}

export async function useApiFetch<T = unknown>(request: string, options?: any): Promise<T> {
  const requestOptions = withConcurrencyHeaders(options)

  if (import.meta.client && isQueueableApiWrite(request, requestOptions) && !navigator.onLine) {
    return await enqueueOfflineOperation(request, requestOptions) as T
  }

  try {
    const result = await $fetch<T>(request, requestOptions)
    setServerUnavailable(false)
    return result as T
  } catch (error) {
    if (isServerUnavailableError(error)) {
      setServerUnavailable(true)
      if (import.meta.client && isQueueableApiWrite(request, requestOptions)) {
        return await enqueueOfflineOperation(request, requestOptions) as T
      }
      throw error
    }
    handleApiAuthError(error)
    throw error
  }
}

function withConcurrencyHeaders(options?: any) {
  if (!options?.body?.updatedAt || String(options?.method || 'GET').toUpperCase() !== 'PUT') {
    return options
  }

  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      'if-unmodified-since': new Date(options.body.updatedAt).toISOString()
    }
  }
}
