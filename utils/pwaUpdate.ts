// Nouvelle version au prochain changement de page (US-184, ADR-0071)

export type PwaUpdate = { needRefresh: boolean, updateServiceWorker: (reloadPage?: boolean) => Promise<void> }

export type UpdateBrowser = {
  // En ligne et serveur joignable : sinon la page rechargée ne pourrait pas être servie
  reachable: boolean
  reload: () => void
  setTimeout: (callback: () => void, delay: number) => unknown
}

// Le module recharge la page dès que le nouveau service worker a la main ; s'il ne la prend pas, la page se recharge
// quand même après ce délai
export const PWA_UPDATE_FALLBACK_MS = 4000

/**
 * Appelé une fois la page changée, sur la page arrivée : si une nouvelle version attend, l'active et recharge cette
 * page, et rend true. Un changement de la seule requête (onglet, filtre) n'est pas un changement de page. Hors ligne ou
 * serveur indisponible, rien ne change.
 */
export function loadNewVersionAfterNavigation(pwa: PwaUpdate | undefined, toPath: string, fromPath: string, browser: UpdateBrowser) {
  if (!pwa?.needRefresh || !browser.reachable || toPath === fromPath) return false
  // Un échec d'activation laisse le rechargement de secours faire le travail
  pwa.updateServiceWorker().catch(() => {})
  browser.setTimeout(browser.reload, PWA_UPDATE_FALLBACK_MS)
  return true
}
