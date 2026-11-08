// Nouvelle version au prochain changement de page (US-184, ADR-0071)

export type PwaUpdate = { needRefresh: boolean, updateServiceWorker: (reloadPage?: boolean) => Promise<void> }

export type UpdateBrowser = {
  online: boolean
  pushState: (url: string) => void
  assign: (url: string) => void
  setTimeout: (callback: () => void, delay: number) => unknown
}

// Le module recharge la page dès que le nouveau service worker a la main ; s'il ne la prend pas, la page visée se
// charge quand même après ce délai
export const PWA_UPDATE_FALLBACK_MS = 4000

/**
 * Si une nouvelle version attend et que l'appareil est en ligne, active la nouvelle version en chargeant la page visée
 * plutôt qu'en y naviguant, et rend true : la navigation de l'application doit alors s'arrêter. Hors ligne, rien ne
 * change, pour ne pas recharger une page que le réseau ne pourrait pas servir.
 */
export function loadNewVersionOnNavigation(pwa: PwaUpdate | undefined, target: string, current: string, browser: UpdateBrowser) {
  if (!pwa?.needRefresh || !browser.online || target === current) return false
  // Le rechargement fait par le module porte sur l'adresse affichée : c'est celle de la page visée
  browser.pushState(target)
  void pwa.updateServiceWorker()
  browser.setTimeout(() => browser.assign(target), PWA_UPDATE_FALLBACK_MS)
  return true
}
