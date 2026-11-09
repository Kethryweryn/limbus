import { isServerUnavailable } from '~/utils/connection'
import { afterNavigation, NewVersionCheck, PWA_UPDATE_PERIOD_MS } from '~/utils/pwaUpdate'

// Une nouvelle version de Limbus se charge au prochain changement de page, jamais pendant une saisie (US-184, ADR-0071).
// Après la navigation : l'historique est déjà juste (ajout ou remplacement), et le rechargement porte sur la page arrivée.
// Elle est cherchée à chaque changement de page et toutes les heures (US-196, ADR-0078)
export default defineNuxtPlugin((nuxtApp) => {
  const check = new NewVersionCheck(Date.now())
  const reachable = () => navigator.onLine && !isServerUnavailable()
  useRouter().afterEach((to, from, failure) => {
    if (failure) return
    afterNavigation(nuxtApp.$pwa, to.path, from.path, {
      reachable: reachable(),
      reload: () => window.location.reload(),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay)
    }, check, Date.now())
  })
  window.setInterval(() => {
    if (!nuxtApp.$pwa?.needRefresh) check.run(nuxtApp.$pwa?.getSWRegistration(), reachable(), Date.now())
  }, PWA_UPDATE_PERIOD_MS)
})
