<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-2xl font-bold">Inscriptions</h1>
      <p class="text-sm text-gray-500">Périodes d’inscription de chaque jeu, pour recruter les PJ des sessions.</p>
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
      />
      <p v-if="!displayedGames.length && !errorMessage" class="text-sm text-gray-500">
        Aucun jeu à afficher.
      </p>
    </div>
  </div>
</template>

<script setup>
import { useGameFocus } from '@/composables/useGameFocus'

const { game: selectedGame } = useGameFocus()
const games = ref([])
const gameFilter = ref('all')
const showArchived = ref(false)
const errorMessage = ref('')

try {
  games.value = await useApiFetch('/api/games')
} catch (err) {
  errorMessage.value = err?.data?.message || err?.message || 'Impossible de charger les jeux'
}

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

// Jeu actif d'abord ; sinon le filtre, sans les jeux archivés sauf demande
const displayedGames = computed(() => {
  if (selectedGame.value?.id) return games.value.filter((game) => game.id === selectedGame.value.id)
  if (gameFilter.value !== 'all') return games.value.filter((game) => game.id === gameFilter.value)
  return games.value
    .filter((game) => showArchived.value || game.published !== false)
    .sort((left, right) => left.title.localeCompare(right.title, 'fr'))
})
</script>
