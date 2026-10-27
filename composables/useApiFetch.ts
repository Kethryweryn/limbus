import { getErrorStatus, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'
import { enqueueOfflineOperation, isQueueableApiWrite } from '~/utils/offlineSync'
import { forgetOfflineAuth } from '~/utils/storage'

// Session expirée ou révoquée : retour à l'écran de connexion. Un 403 n'est qu'un refus
// ponctuel (action réservée au propriétaire, ressource d'un autre jeu) : on reste connecté.
// Les données hors ligne sont gardées : le même compte les retrouve en se reconnectant.
export function handleApiAuthError(error: any): void {
  if (!import.meta.client || getErrorStatus(error) !== 401) return

  forgetOfflineAuth()
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
