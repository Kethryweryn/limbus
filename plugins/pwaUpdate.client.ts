import { loadNewVersionOnNavigation } from '~/utils/pwaUpdate'

// Une nouvelle version de Limbus se charge au prochain changement de page, jamais pendant une saisie (US-184, ADR-0071)
export default defineNuxtPlugin((nuxtApp) => {
  useRouter().beforeEach((to, from) => {
    const tookOver = loadNewVersionOnNavigation(nuxtApp.$pwa, to.fullPath, from.fullPath, {
      online: navigator.onLine,
      pushState: (url) => window.history.pushState(null, '', url),
      assign: (url) => window.location.assign(url),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay)
    })
    if (tookOver) return false
  })
})
