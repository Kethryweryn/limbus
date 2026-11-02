import type { NitroFetchRequest } from 'nitropack/types'
import type { ApiResponse } from '~/composables/useApiFetch'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

// Pages de liste hors ligne (US-047) : ce que chaque page d'index refaisait à l'identique

/** Liste lue sur l'appareil hors ligne, sinon par l'API, et gardée alors sur l'appareil. */
export async function fetchOfflineList<R extends NitroFetchRequest>(store: string, request: R): Promise<NoInfer<ApiResponse<R>>> {
  type List = ApiResponse<R>
  if (isOfflineMode()) return await getFromStore<List>(store, 'list') || [] as unknown as List

  // La réponse est déjà typée par la route : l'appel n'a pas à refaire la déduction en générique
  const data = await (useApiFetch as unknown as (request: string) => Promise<List>)(String(request))
  // Un appareil sans stockage (navigation privée…) n'empêche pas d'afficher la liste
  await saveToStore(store, 'list', data).catch((error) => console.error(`[storage] ${store}`, error))
  return data
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
