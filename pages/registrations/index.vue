<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-2xl font-bold">Inscriptions</h1>
      <p class="text-sm text-gray-500">Périodes d’inscription et formulaire de chaque jeu, pour recruter les PJ des sessions.</p>
    </div>

    <GameContextBar />

    <div v-if="!selectedGame" class="flex flex-col gap-4 md:flex-row">
      <USelect
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
      <AppCheckboxRow
        v-model="showArchived"
        label="Afficher les jeux archivés"
        class="md:w-72"
      />
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :description="errorMessage"
    />

    <div class="space-y-6">
      <RegistrationPeriodsPanel
        v-for="game in displayedGames"
        :key="game.id"
        :game-id="game.id"
        :game-title="game.title"
        :initial-periods="periodsByGame[game.id] || []"
      />
      <p v-if="!displayedGames.length && !errorMessage" class="text-sm text-gray-500">
        Aucun jeu à afficher.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameFocus } from '@/composables/useGameFocus'
import { isArchivedGame } from '~/utils/games'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import type { RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

const { game: selectedGame } = useGameFocus()
const games = ref<ApiResponse<'/api/games'>>([])
const gameFilter = ref('all')
const showArchived = ref(false)
const errorMessage = ref('')

const periodsByGame = ref<Record<string, RegistrationPeriod[]>>({})

// Une seule requête pour toutes les périodes et leurs inscriptions ; chaque bloc se recharge ensuite seul. La page se
// lit hors ligne depuis sa dernière version sur l'appareil (US-119)
async function loadData() {
  try {
    const [allGames, periods] = await Promise.all([
      fetchOfflineList('games', '/api/games'),
      useApiFetch('/api/registration-periods', { offlineCache: true })
    ])
    games.value = allGames
    periodsByGame.value = periods.reduce<Record<string, RegistrationPeriod[]>>((groups, period) => {
      (groups[period.gameId] ||= []).push(period)
      return groups
    }, {})
    errorMessage.value = ''
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible de charger les inscriptions')
  }
}

useConnectionRefresh(loadData)
onMounted(loadData)

const visibleGames = computed(() => games.value.filter((game) => showArchived.value || !isArchivedGame(game)))

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...visibleGames.value.map((game) => ({ label: game.title, value: game.id }))
])

// Un jeu choisi puis masqué en décochant « archivés » : on revient à « Tous les jeux »
watch(visibleGames, (visible) => {
  if (gameFilter.value !== 'all' && !visible.some((game) => game.id === gameFilter.value)) gameFilter.value = 'all'
})

// Jeu actif d'abord ; sinon le filtre, sans les jeux archivés sauf demande
const displayedGames = computed(() => {
  const focused = selectedGame.value?.id
  if (focused) return games.value.filter((game) => game.id === focused)
  if (gameFilter.value !== 'all') return games.value.filter((game) => game.id === gameFilter.value)
  return [...visibleGames.value]
    .sort((left, right) => left.title.localeCompare(right.title, 'fr'))
})
</script>
