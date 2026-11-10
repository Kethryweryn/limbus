// Réglages du hors ligne propres à l'appareil (SPEC-019, ADR-0081) : rien ne passe par le serveur

// Hors ligne désactivé sur cet appareil (R5 à R7) : gardé après la déconnexion et la connexion d'un autre compte
export const OFFLINE_DISABLED_KEY = 'limbusOfflineDisabled'

export function isOfflineDisabled() {
  try {
    return localStorage.getItem(OFFLINE_DISABLED_KEY) === 'true'
  } catch {
    return false
  }
}

export function setOfflineDisabled(disabled: boolean) {
  if (disabled) localStorage.setItem(OFFLINE_DISABLED_KEY, 'true')
  else localStorage.removeItem(OFFLINE_DISABLED_KEY)
}

export type OfflineStorageSize = {
  // Pages, PDF et photos gardés ; null quand le navigateur ne permet pas de les mesurer
  data: number | null
  // Place que le navigateur réserve à Limbus, application comprise (navigator.storage.estimate)
  total: number | null
}

const encoder = new TextEncoder()

// Taille d'un enregistrement de la base, tel qu'il est sérialisé
export function serializedSize(value: unknown) {
  return encoder.encode(JSON.stringify(value) ?? '').length
}

// Taille d'une réponse gardée, lue dans son en-tête : le fichier n'est pas lu (US-223)
export function responseSize(response: Pick<Response, 'headers'> | undefined) {
  const length = Number(response?.headers.get('content-length'))
  return Number.isFinite(length) && length > 0 ? length : 0
}

export async function storageEstimate(): Promise<number | null> {
  try {
    const estimate = await navigator.storage?.estimate?.()
    return typeof estimate?.usage === 'number' ? estimate.usage : null
  } catch {
    return null
  }
}

export async function cachedFilesSize(cacheNames: string[]): Promise<number | null> {
  if (typeof caches === 'undefined') return null
  let total = 0
  for (const name of cacheNames) {
    if (!(await caches.has(name))) continue
    const cache = await caches.open(name)
    for (const request of await cache.keys()) total += responseSize(await cache.match(request))
  }
  return total
}

// Retire l'application gardée sur l'appareil (service worker et ses caches, précache compris) : sans elle, Limbus ne
// s'ouvre plus sans réseau (R5)
export async function removeInstalledApp() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => [])
    await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)))
  }
  if (typeof caches !== 'undefined') {
    const names = await caches.keys().catch(() => [])
    await Promise.all(names.map((name) => caches.delete(name).catch(() => false)))
  }
}
