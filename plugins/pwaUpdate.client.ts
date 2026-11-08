import { isServerUnavailable } from '~/utils/connection'
import { loadNewVersionAfterNavigation } from '~/utils/pwaUpdate'

// Une nouvelle version de Limbus se charge au prochain changement de page, jamais pendant une saisie (US-184, ADR-0071).
// Après la navigation : l'historique est déjà juste (ajout ou remplacement), et le rechargement porte sur la page arrivée
export default defineNuxtPlugin((nuxtApp) => {
  useRouter().afterEach((to, from, failure) => {
    if (failure) return
    loadNewVersionAfterNavigation(nuxtApp.$pwa, to.path, from.path, {
      reachable: navigator.onLine && !isServerUnavailable(),
      reload: () => window.location.reload(),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay)
    })
  })
})
