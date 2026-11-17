import { isServerUnavailable } from '~/utils/connection'
import { afterNavigation, NewVersionCheck, PWA_UPDATE_PERIOD_MS } from '~/utils/pwaUpdate'

// Une nouvelle version est cherchée à chaque changement de page et toutes les heures (US-196, ADR-0078) ; trouvée, elle
// est proposée par le bandeau (components/AppUpdateBanner.vue), et ne se charge jamais d'elle-même (US-254, ADR-0093)
export default defineNuxtPlugin((nuxtApp) => {
  const check = new NewVersionCheck(Date.now())
  const reachable = () => navigator.onLine && !isServerUnavailable()
  useRouter().afterEach((to, from, failure) => {
    if (failure) return
    afterNavigation(nuxtApp.$limbusPwa, to.path, from.path, reachable(), check, Date.now())
  })
  // Une version qui attend n'arrête pas la recherche : une plus récente rouvre le bandeau fermé
  window.setInterval(() => check.run(nuxtApp.$limbusPwa?.getSWRegistration(), reachable(), Date.now()), PWA_UPDATE_PERIOD_MS)
})
