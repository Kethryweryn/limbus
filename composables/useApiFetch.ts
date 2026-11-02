import type { NitroFetchOptions, NitroFetchRequest, TypedInternalResponse } from 'nitropack/types'
import { getErrorStatus, isOfflineMode, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'
import { enqueueOfflineOperation, isQueueableApiWrite } from '~/utils/offlineSync'
import { forgetOfflineAuth, getCachedResponse, saveCachedResponse } from '~/utils/storage'

// Types des appels à l'API (US-114, ADR-0057) : la réponse est déduite de la route Nitro appelée, comme pour $fetch

/** Options propres à Limbus, en plus de celles de $fetch. */
export type ApiFetchExtras = { offlineCache?: boolean, offlineLabel?: string }

/** Réponse d'une écriture mise en file hors ligne (ADR-0036) : les champs envoyés, marqués. */
export type OfflineQueuedResponse = { __offlineQueued: true, __offlinePending?: true } & Record<string, unknown>

export function isOfflineQueued(value: unknown): value is OfflineQueuedResponse {
  return typeof value === 'object' && value !== null && (value as { __offlineQueued?: unknown }).__offlineQueued === true
}

/** Réponse d'une route pour typer un état (`ref<ApiResponse<'/api/games'>>`) ; route dynamique sous sa forme Nitro (`/api/games/:id`). */
export type ApiResponse<R extends NitroFetchRequest, M extends HttpMethod = 'get'> = TypedInternalResponse<R, unknown, M>

/** Réponse d'une action (envoi, génération, partage…) : jamais mise en file hors ligne, elle est donc celle du serveur. */
export function actionResult<T>(value: T): Exclude<T, OfflineQueuedResponse> {
  if (isOfflineQueued(value)) throw new Error('Cette action n’est pas disponible hors ligne.')
  return value as Exclude<T, OfflineQueuedResponse>
}

type HttpMethod = 'get' | 'head' | 'options' | 'post' | 'put' | 'patch' | 'delete'
type AnyCaseMethod = HttpMethod | Uppercase<HttpMethod>
type ApiOptions<M extends AnyCaseMethod> = Omit<NitroFetchOptions<NitroFetchRequest>, 'method'> & ApiFetchExtras & { method?: M }

// Comme $fetch : la réponse est celle de la route et de la méthode appelées ; une écriture peut aussi rendre sa mise
// en file hors ligne. La méthode est lue telle qu'écrite dans l'appel (sans la déduire des routes, trop coûteux)
type ApiFetch = <T = unknown, R extends NitroFetchRequest = NitroFetchRequest, M extends AnyCaseMethod = 'get'>(
  request: R,
  options?: ApiOptions<M>
) => Promise<Lowercase<M> extends 'get' | 'head' | 'options' ? TypedInternalResponse<R, T, 'get'> : TypedInternalResponse<R, T, Lowercase<M>> | OfflineQueuedResponse>

// Session expirée ou révoquée : retour à l'écran de connexion. Un 403 n'est qu'un refus
// ponctuel (action réservée au propriétaire, ressource d'un autre jeu) : on reste connecté.
// Les données hors ligne sont gardées : le même compte les retrouve en se reconnectant.
export function handleApiAuthError(error: unknown): void {
  if (!import.meta.client || getErrorStatus(error) !== 401) return

  forgetOfflineAuth()
  window.location.reload()
}

/**
 * Appel de l'API. Options propres à Limbus :
 * - offlineCache : lecture gardée sur l'appareil, et rendue depuis lui hors ligne (US-047) ;
 * - offlineLabel : précision montrée dans le panneau des modifications si l'écriture part en file (US-049).
 */
export const useApiFetch = ((request: string, options?: RawOptions) => apiFetch(request, options)) as unknown as ApiFetch

// Implémentation non typée par route : la file hors ligne et le cache de l'appareil ne connaissent que l'URL
const rawFetch = $fetch as unknown as (request: string, options?: RawOptions) => Promise<unknown>
type RawOptions = Record<string, unknown> & ApiFetchExtras & { body?: Record<string, unknown> | FormData, method?: string, headers?: Record<string, string> }

async function apiFetch(request: string, options?: RawOptions): Promise<unknown> {
  const { offlineCache, offlineLabel, ...fetchOptions } = options || {}
  const requestOptions = withConcurrencyHeaders(options ? fetchOptions : undefined)

  if (offlineCache && import.meta.client) {
    return await fetchWithOfflineCache(request, requestOptions)
  }

  if (import.meta.client && isQueueableApiWrite(request, requestOptions) && !navigator.onLine) {
    return await enqueueOfflineOperation(request, { ...requestOptions, offlineLabel })
  }

  try {
    const result = await rawFetch(request, requestOptions)
    setServerUnavailable(false)
    return result
  } catch (error) {
    if (isServerUnavailableError(error)) {
      setServerUnavailable(true)
      if (import.meta.client && isQueueableApiWrite(request, requestOptions)) {
        return await enqueueOfflineOperation(request, { ...requestOptions, offlineLabel })
      }
      throw error
    }
    handleApiAuthError(error)
    throw error
  }
}

async function fetchWithOfflineCache<T>(request: string, options?: RawOptions): Promise<T> {
  if (isOfflineMode()) return await cachedResponseOrThrow<T>(request)

  try {
    const result = await rawFetch(request, options)
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

function withConcurrencyHeaders(options?: RawOptions): RawOptions | undefined {
  const updatedAt = options?.body && !(options.body instanceof FormData) ? options.body.updatedAt : undefined
  if (!updatedAt || String(options?.method || 'GET').toUpperCase() !== 'PUT') {
    return options
  }

  return {
    ...options,
    headers: {
      ...(options?.headers || {}),
      'if-unmodified-since': new Date(updatedAt as string).toISOString()
    }
  }
}
