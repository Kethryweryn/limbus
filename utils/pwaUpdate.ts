// Nouvelle version au prochain changement de page (US-184, ADR-0071), cherchée à chaque changement de page et toutes les
// heures (US-196, ADR-0078)

export type UpdateRegistration = { installing: unknown, update: () => Promise<unknown> }

export type PwaUpdate = {
  needRefresh: boolean
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  getSWRegistration: () => UpdateRegistration | undefined
}

export type UpdateBrowser = {
  // En ligne et serveur joignable : sinon la page rechargée ne pourrait pas être servie, ni la version cherchée
  reachable: boolean
  reload: () => void
  setTimeout: (callback: () => void, delay: number) => unknown
}

// Le module recharge la page dès que le nouveau service worker a la main ; s'il ne la prend pas, la page se recharge
// quand même après ce délai
export const PWA_UPDATE_FALLBACK_MS = 4000

// Le navigateur ne cherche un nouveau service worker qu'au chargement complet d'une page : Limbus le lui demande, une
// fois par minute au plus, et toutes les heures sur une page restée ouverte
export const PWA_UPDATE_CHECK_MS = 60_000
export const PWA_UPDATE_PERIOD_MS = 60 * 60_000

/**
 * Recherche d'une nouvelle version, une fois par minute au plus. La version trouvée se télécharge en arrière-plan et se
 * charge au changement de page suivant.
 */
export class NewVersionCheck {
  // Le chargement complet de la page vient de faire chercher le navigateur
  constructor(private lastCheck: number) {}

  /** Rend true si la recherche est lancée. */
  run(registration: UpdateRegistration | undefined, reachable: boolean, now: number) {
    if (!registration || registration.installing || !reachable || now - this.lastCheck < PWA_UPDATE_CHECK_MS) return false
    const previous = this.lastCheck
    this.lastCheck = now
    // Un échec (réseau coupé entre-temps) ne fait pas attendre la recherche suivante
    registration.update().catch(() => {
      if (this.lastCheck === now) this.lastCheck = previous
    })
    return true
  }
}

/**
 * Appelé une fois la page changée, sur la page arrivée. Un changement de la seule requête (onglet, filtre) n'est pas un
 * changement de page. Hors ligne ou serveur indisponible, rien ne change. Sinon, si une nouvelle version attend, l'active
 * et recharge cette page ; sinon, en fait chercher une.
 */
export function afterNavigation(pwa: PwaUpdate | undefined, toPath: string, fromPath: string, browser: UpdateBrowser, check: NewVersionCheck, now: number) {
  if (!pwa || !browser.reachable || toPath === fromPath) return 'nothing'
  if (!pwa.needRefresh) return check.run(pwa.getSWRegistration(), true, now) ? 'check' : 'nothing'
  // Un échec d'activation laisse le rechargement de secours faire le travail
  pwa.updateServiceWorker().catch(() => {})
  browser.setTimeout(browser.reload, PWA_UPDATE_FALLBACK_MS)
  return 'reload'
}
