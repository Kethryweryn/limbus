<template>
  <div class="p-6 space-y-4">
    <div class="space-y-1">
      <NuxtLink v-if="!selectedGame" to="/registrations" class="text-sm text-gray-500 hover:underline">← Tous les jeux</NuxtLink>
      <h1 class="text-2xl font-bold">{{ game?.title || 'Inscriptions' }}</h1>
      <p class="text-sm text-gray-500">Inscriptions du jeu : ses sessions, son vivier et ses réglages.</p>
    </div>

    <GameContextBar />

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :description="errorMessage"
    />

    <RegistrationPeriodsPanel
      v-if="game"
      :key="game.id"
      :game-id="game.id"
      :game-title="game.title"
      :initial-periods="gamePeriods"
    />
  </div>
</template>

<script setup lang="ts">
import { useGameFocus } from '@/composables/useGameFocus'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import type { RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'
import { REGISTRATION_PERIODS_READ } from '~/utils/offlinePlan'

// Page Inscriptions d'un jeu (SPEC-020, R4) : ses onglets Sessions, Vivier et Réglages. Elle lit les mêmes listes que
// le résumé, et se relit donc hors ligne comme lui (R14)
const route = useRoute()
const { game: selectedGame } = useGameFocus()
const games = ref<ApiResponse<'/api/games'>>([])
const periods = ref<RegistrationPeriod[]>([])
const errorMessage = ref('')
const loaded = ref(false)

const game = computed(() => games.value.find((item) => item.slug === route.params.slug))
// Un nouveau tableau seulement après une lecture : le bloc ne reprend le vivier de la page qu'alors
const gamePeriods = computed(() => periods.value.filter((period) => period.gameId === game.value?.id))

async function loadData() {
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

useConnectionRefresh(loadData)
onMounted(loadData)

// Un jeu introuvable ou sans accès : le même message, sans dire s'il existe
watch([loaded, game], ([done, found]) => {
  if (done && !found && !errorMessage.value) errorMessage.value = 'Ce jeu est introuvable, ou vous n’y avez pas accès.'
})
</script>
