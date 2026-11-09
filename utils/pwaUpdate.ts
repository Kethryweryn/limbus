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

// Le navigateur ne cherche un nouveau service worker qu'au chargement complet d'une page : une navigation dans
// l'application le lui demande, une fois par minute au plus (US-196, ADR-0078)
export const PWA_UPDATE_CHECK_MS = 60_000

export type UpdateRegistration = { installing: unknown, update: () => Promise<unknown> }

/**
 * Appelé après un changement de page sans version en attente : demande au navigateur de chercher une nouvelle version,
 * qui se chargera au changement de page suivant. Rend l'heure de la recherche faite, ou `lastCheck` inchangé.
 */
export function checkForNewVersion(registration: UpdateRegistration | undefined, reachable: boolean, now: number, lastCheck: number) {
  if (!registration || registration.installing || !reachable || now - lastCheck < PWA_UPDATE_CHECK_MS) return lastCheck
  // Un échec (réseau coupé entre-temps) attend la recherche suivante
  registration.update().catch(() => {})
  return now
}
