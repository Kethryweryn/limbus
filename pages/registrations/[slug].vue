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
import { useRegistrationLists } from '~/composables/useRegistrationLists'

// Page Inscriptions d'un jeu (SPEC-020, R4) : ses onglets Sessions, Vivier et Réglages. Elle lit les mêmes listes que
// le résumé, et se relit donc hors ligne comme lui (R14)
const route = useRoute()
const { game: selectedGame, selectGame } = useGameFocus()
const { games, periods, errorMessage, loaded } = useRegistrationLists()

const game = computed(() => games.value.find((item) => item.slug === route.params.slug))
// Un nouveau tableau seulement après une lecture : le bloc ne reprend le vivier de la page qu'alors
const gamePeriods = computed(() => periods.value.filter((period) => period.gameId === game.value?.id))

// Ouverte avec un autre jeu actif (lien de l'email, lien copié), la page rend ce jeu actif : la barre et le reste de
// l'application suivent le jeu affiché
watch(game, (found) => {
  if (found && selectedGame.value && selectedGame.value.id !== found.id) selectGame({ id: found.id, title: found.title })
})

// Un jeu introuvable ou sans accès : le même message, sans dire s'il existe
watch([loaded, game], ([done, found]) => {
  if (done && !found && !errorMessage.value) errorMessage.value = 'Ce jeu est introuvable, ou vous n’y avez pas accès.'
})
</script>
