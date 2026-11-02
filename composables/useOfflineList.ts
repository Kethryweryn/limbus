import type { NitroFetchRequest } from 'nitropack/types'
import { onMounted, onUnmounted, ref } from 'vue'
import { useApiFetch, type ApiResponse } from '~/composables/useApiFetch'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

// Pages lisibles hors ligne (US-047) : ce que chaque page de liste et le tableau de bord refaisaient à l'identique

/** Réponse lue sur l'appareil hors ligne (null si jamais lue), sinon par l'API, et gardée alors sur l'appareil. */
export async function fetchOffline<R extends NitroFetchRequest>(store: string, key: string, request: R): Promise<NoInfer<ApiResponse<R>> | null> {
  type Response = ApiResponse<R>
  if (isOfflineMode()) return await getFromStore<Response>(store, key)

  // La réponse est déjà typée par la route : l'appel n'a pas à refaire la déduction en générique
  const data = await (useApiFetch as unknown as (request: string) => Promise<Response>)(String(request))
  // Un appareil sans stockage (navigation privée…) n'empêche pas d'afficher la réponse
  await saveToStore(store, key, data).catch((error) => console.error(`[storage] ${store}/${key}`, error))
  return data
}

/** Liste d'une page de liste : vide si elle n'a jamais été lue sur l'appareil. */
export async function fetchOfflineList<R extends NitroFetchRequest>(store: string, request: R): Promise<NoInfer<ApiResponse<R>>> {
  return await fetchOffline(store, 'list', request) || [] as unknown as ApiResponse<R>
}

/** Relit la page quand Limbus passe hors ligne ou revient en ligne ; isOffline suit l'état de la connexion. */
export function useConnectionRefresh(refresh: () => unknown) {
  const isOffline = ref(false)

  const update = () => {
    const wasOffline = isOffline.value
    isOffline.value = isOfflineMode()
    if (wasOffline !== isOffline.value) refresh()
  }

  onMounted(() => {
    isOffline.value = isOfflineMode()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('limbus:connection-change', update)
  })

  onUnmounted(() => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
    window.removeEventListener('limbus:connection-change', update)
  })

  return { isOffline }
}
