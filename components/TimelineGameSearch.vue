<template>
  <!-- Choix du jeu de la timeline par son titre (US-115) : un jeu archivé se choisit ici -->
  <div class="relative w-full md:w-80">
    <UInput
      v-model="search"
      placeholder="Rechercher un jeu..."
      icon="i-heroicons-magnifying-glass"
      class="w-full"
    />
    <div
      v-if="search && !hasSelection"
      class="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow"
    >
      <button
        v-for="game in matchingGames"
        :key="game.id"
        type="button"
        class="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
        @click="emit('select', game)"
      >
        {{ game.title }}
        <span v-if="isArchivedGame(game)" class="text-gray-500">(archivé)</span>
      </button>
      <div v-if="!matchingGames.length" class="px-3 py-2 text-sm text-gray-500">
        Aucun jeu trouvé.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isArchivedGame } from '~/utils/games'
import type { TimelineGame } from '~/utils/timeline'

const search = defineModel<string>('search', { default: '' })

const props = defineProps<{ games: TimelineGame[], hasSelection: boolean }>()
const emit = defineEmits<{ select: [game: TimelineGame] }>()

const matchingGames = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return props.games.slice(0, 10)

  return props.games
    .filter((game) => game.title.toLowerCase().includes(term))
    .slice(0, 10)
})
</script>
