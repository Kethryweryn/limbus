import { getErrorStatus, isOfflineMode, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'
import { enqueueOfflineOperation, isQueueableApiWrite } from '~/utils/offlineSync'
import { forgetOfflineAuth, getCachedResponse, saveCachedResponse } from '~/utils/storage'

// Session expirée ou révoquée : retour à l'écran de connexion. Un 403 n'est qu'un refus
// ponctuel (action réservée au propriétaire, ressource d'un autre jeu) : on reste connecté.
// Les données hors ligne sont gardées : le même compte les retrouve en se reconnectant.
export function handleApiAuthError(error: any): void {
  if (!import.meta.client || getErrorStatus(error) !== 401) return

  forgetOfflineAuth()
  window.location.reload()
}

/**
 * Appel de l'API. Options propres à Limbus :
 * - offlineCache : lecture gardée sur l'appareil, et rendue depuis lui hors ligne (US-047) ;
 * - offlineLabel : précision montrée dans le panneau des modifications si l'écriture part en file (US-049).
 */
export async function useApiFetch<T = unknown>(request: string, options?: any): Promise<T> {
  const { offlineCache, offlineLabel, ...fetchOptions } = options || {}
  const requestOptions = withConcurrencyHeaders(options ? fetchOptions : undefined)

  if (offlineCache && import.meta.client) {
    return await fetchWithOfflineCache<T>(request, requestOptions)
  }

  if (import.meta.client && isQueueableApiWrite(request, requestOptions) && !navigator.onLine) {
    return await enqueueOfflineOperation(request, { ...requestOptions, offlineLabel }) as T
  }

  try {
    const result = await $fetch<T>(request, requestOptions)
    setServerUnavailable(false)
    return result as T
  } catch (error) {
    if (isServerUnavailableError(error)) {
      setServerUnavailable(true)
      if (import.meta.client && isQueueableApiWrite(request, requestOptions)) {
        return await enqueueOfflineOperation(request, { ...requestOptions, offlineLabel }) as T
      }
      throw error
    }
    handleApiAuthError(error)
    throw error
  }
}

async function fetchWithOfflineCache<T>(request: string, options?: any): Promise<T> {
  if (isOfflineMode()) return await cachedResponseOrThrow<T>(request)

  try {
    const result = await $fetch<T>(request, options)
    setServerUnavailable(false)
    await saveCachedResponse(request, result)
    return result as T
  } catch (error) {
    if (isServerUnavailableError(error)) {
      setServerUnavailable(true)
      return await cachedResponseOrThrow<T>(request)
    }
    handleApiAuthError(error)
    throw error
  }
}

async function cachedResponseOrThrow<T>(request: string): Promise<T> {
  const cached = await getCachedResponse<T>(request)
  if (cached === null) {
    throw Object.assign(new Error('Cette page n’a pas été consultée avec le réseau sur cet appareil : elle n’est pas disponible hors ligne.'), { offlineMissing: true })
  }
  return cached
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
