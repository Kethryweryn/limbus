import type { ApiResponse } from '~/composables/useApiFetch'
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import type { RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'
import { apiErrorMessage } from '~/utils/apiErrors'
import { REGISTRATION_PERIODS_READ } from '~/utils/offlinePlan'

/**
 * Jeux et viviers lus par le résumé et la page d'un jeu (SPEC-020) : une seule requête pour tous les viviers et leurs
 * personnes, relue au changement de connexion, et lisible hors ligne depuis la dernière lecture (US-119, R14).
 */
export function useRegistrationLists() {
  const games = ref<ApiResponse<'/api/games'>>([])
  const periods = ref<RegistrationPeriod[]>([])
  const errorMessage = ref('')
  const loaded = ref(false)

  async function load() {
    try {
      const [allGames, allPeriods] = await Promise.all([
        fetchOfflineList('games', '/api/games'),
        useApiFetch(REGISTRATION_PERIODS_READ, { offlineCache: true })
      ])
      games.value = allGames
      periods.value = allPeriods
      errorMessage.value = ''
    } catch (err) {
      errorMessage.value = apiErrorMessage(err, 'Impossible de charger les inscriptions')
    } finally {
      loaded.value = true
    }
  }

  useConnectionRefresh(load)
  onMounted(load)
  return { games, periods, errorMessage, loaded }
}
