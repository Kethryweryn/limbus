<template>
  <!-- Raccourcis vers une timeline (US-115) : jeux en cours seulement ; un jeu archivé se choisit par la recherche (US-013) -->
  <div v-if="shortcuts.length" class="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
    <UCard
      v-for="shortcut in shortcuts"
      :key="shortcut.key"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ shortcut.label }}
          </div>
          <div class="truncate font-medium">{{ shortcut.game.title }}</div>
          <div class="text-sm text-gray-500">{{ shortcut.detail }}</div>
        </div>
        <UButton
          color="primary"
          variant="soft"
          size="sm"
          @click="emit('select', shortcut.game)"
        >
          Ouvrir
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { isArchivedGame } from '~/utils/games'
import type { TimelineGame } from '~/utils/timeline'

const props = defineProps<{ games: TimelineGame[] }>()
const emit = defineEmits<{ select: [game: TimelineGame] }>()

const activeGames = computed(() => props.games.filter((game) => !isArchivedGame(game)))

const writingDate = (game: TimelineGame) => game.lastWritingActivityAt || game.lastActivityAt || game.updatedAt

const latestWritingGame = computed(() =>
  [...activeGames.value]
    .filter((game) => writingDate(game))
    .sort((a, b) => new Date(writingDate(b)).getTime() - new Date(writingDate(a)).getTime())[0] || null
)

const nextSessionGame = computed(() =>
  [...activeGames.value]
    .filter((game) => game.nextScheduledSessionAt)
    .sort((a, b) =>
      new Date(a.nextScheduledSessionAt!).getTime() - new Date(b.nextScheduledSessionAt!).getTime()
    )[0] || null
)

const shortcuts = computed(() => {
  const result: Array<{ key: string, label: string, game: TimelineGame, detail: string }> = []
  if (latestWritingGame.value) {
    result.push({
      key: `writing-${latestWritingGame.value.id}`,
      label: 'Dernière modification en écriture',
      game: latestWritingGame.value,
      detail: `Modifié le ${formatDate(writingDate(latestWritingGame.value))}`
    })
  }

  if (nextSessionGame.value) {
    result.push({
      key: `session-${nextSessionGame.value.id}`,
      label: 'Prochaine session prévue',
      game: nextSessionGame.value,
      detail: `${formatDate(nextSessionGame.value.nextScheduledSessionAt)} · ${nextSessionGame.value.nextScheduledSession?.name || 'Session'}`
    })
  }

  return result
})

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date inconnue'
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
</script>
