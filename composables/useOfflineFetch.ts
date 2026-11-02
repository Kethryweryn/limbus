import type { NitroFetchRequest, TypedInternalResponse } from 'nitropack/types'
import { isOfflineMode } from '~/utils/connection'
import { saveCachedResponse } from '~/utils/storage'

/**
 * Lecture d'une page rendue côté serveur, gardée pour le hors ligne (US-047) : côté serveur, la requête de la
 * page (cookies compris) ; côté navigateur, useApiFetch avec le cache de l'appareil. La réponse reçue à
 * l'hydratation est gardée elle aussi.
 */
export function useOfflineFetch<T = unknown, R extends NitroFetchRequest = NitroFetchRequest>(request: R) {
  type Response = TypedInternalResponse<R, T, 'get'>
  const requestFetch = useRequestFetch() as unknown as (request: string) => Promise<Response>
  const key = String(request)
  const result = useAsyncData<Response>(key, () => import.meta.server
    ? requestFetch(key)
    : fetchByUrl<Response>(key, { offlineCache: true }))

  if (import.meta.client) {
    watch(result.data, (value) => {
      if (value != null && !isOfflineMode()) saveCachedResponse(key, value)
    }, { immediate: true })
  }

  return result
}
