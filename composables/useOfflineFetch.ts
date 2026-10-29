import { isOfflineMode } from '~/utils/connection'
import { saveCachedResponse } from '~/utils/storage'

/**
 * Lecture d'une page rendue côté serveur, gardée pour le hors ligne (US-047) : côté serveur, la requête de la
 * page (cookies compris) ; côté navigateur, useApiFetch avec le cache de l'appareil. La réponse reçue à
 * l'hydratation est gardée elle aussi.
 */
export function useOfflineFetch<T = any>(request: string) {
  const requestFetch = useRequestFetch()
  const result = useAsyncData<T>(request, () => import.meta.server
    ? requestFetch(request) as Promise<T>
    : useApiFetch<T>(request, { offlineCache: true }))

  if (import.meta.client) {
    watch(result.data, (value) => {
      if (value != null && !isOfflineMode()) saveCachedResponse(request, value)
    }, { immediate: true })
  }

  return result
}
