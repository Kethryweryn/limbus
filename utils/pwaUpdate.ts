// Nouvelle version proposée par un bandeau, jamais chargée d'elle-même (US-254, ADR-0093), cherchée à chaque changement
// de page et toutes les heures (US-196, ADR-0078)

export type UpdateRegistration = { installing: unknown, waiting: unknown, update: () => Promise<unknown> }

export type PwaUpdate = {
  // Une nouvelle version attend : le bandeau la propose
  needRefresh: boolean
  // Bandeau fermé par la croix, jusqu'au prochain chargement de la page ou à une version plus récente
  dismissed: boolean
  // « Recharger » choisi dans cet onglet : la prise de main par la nouvelle version recharge alors l'onglet
  applying: boolean
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  getSWRegistration: () => UpdateRegistration | undefined
}

export type UpdateBrowser = {
  reload: () => void
  setTimeout: (callback: () => void, delay: number) => unknown
}

// « Recharger » : la page se recharge quand le nouveau service worker a la main ; s'il ne la prend pas, après ce délai
export const PWA_UPDATE_FALLBACK_MS = 4000

// Le navigateur ne cherche un nouveau service worker qu'au chargement complet d'une page : Limbus le lui demande, une
// fois par minute au plus, et toutes les heures sur une page restée ouverte
export const PWA_UPDATE_CHECK_MS = 60_000
export const PWA_UPDATE_PERIOD_MS = 60 * 60_000

/**
 * Recherche d'une nouvelle version, une fois par minute au plus. La version trouvée se télécharge en arrière-plan, puis
 * le bandeau la propose.
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
 * Appelé une fois la page changée. Un changement de la seule requête (onglet, filtre) n'est pas un changement de page.
 * Hors ligne ou serveur indisponible, rien n'est cherché. Une version qui attend n'empêche pas d'en chercher une plus
 * récente, que le bandeau proposera de nouveau. Ne recharge jamais rien.
 */
export function afterNavigation(pwa: PwaUpdate | undefined, toPath: string, fromPath: string, reachable: boolean, check: NewVersionCheck, now: number) {
  if (!pwa || !reachable || toPath === fromPath) return 'nothing'
  return check.run(pwa.getSWRegistration(), true, now) ? 'check' : 'nothing'
}

/**
 * « Recharger » : active la version qui attend, et l'onglet se recharge quand elle a pris la main (onNeedReload), ou
 * après PWA_UPDATE_FALLBACK_MS. Déjà activée par un autre onglet, plus rien n'attend : l'onglet se recharge aussitôt.
 */
export function applyUpdate(pwa: PwaUpdate, browser: UpdateBrowser) {
  pwa.applying = true
  if (!pwa.getSWRegistration()?.waiting) {
    browser.reload()
    return 'reload'
  }
  // Un échec d'activation laisse le rechargement de secours faire le travail
  pwa.updateServiceWorker().catch(() => {})
  browser.setTimeout(browser.reload, PWA_UPDATE_FALLBACK_MS)
  return 'activate'
}
