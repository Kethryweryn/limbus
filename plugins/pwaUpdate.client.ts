import { isServerUnavailable } from '~/utils/connection'
import { checkForNewVersion, loadNewVersionAfterNavigation } from '~/utils/pwaUpdate'

// Une nouvelle version de Limbus se charge au prochain changement de page, jamais pendant une saisie (US-184, ADR-0071).
// Après la navigation : l'historique est déjà juste (ajout ou remplacement), et le rechargement porte sur la page arrivée.
// Sans version en attente, la navigation en fait chercher une (US-196, ADR-0078)
export default defineNuxtPlugin((nuxtApp) => {
  let lastCheck = Number.NEGATIVE_INFINITY
  useRouter().afterEach((to, from, failure) => {
    if (failure) return
    const reachable = navigator.onLine && !isServerUnavailable()
    const loading = loadNewVersionAfterNavigation(nuxtApp.$pwa, to.path, from.path, {
      reachable,
      reload: () => window.location.reload(),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay)
    })
    if (!loading && !nuxtApp.$pwa?.needRefresh && to.path !== from.path) {
      lastCheck = checkForNewVersion(nuxtApp.$pwa?.getSWRegistration(), reachable, Date.now(), lastCheck)
    }
  })
})
