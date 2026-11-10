<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-2xl font-bold">Inscriptions</h1>
      <p class="text-sm text-gray-500">Le vivier et le formulaire de chaque jeu, pour recruter les PJ des sessions.</p>
    </div>

    <GameContextBar />

    <AppCheckboxRow
      v-model="showArchived"
      label="Afficher les jeux archivés"
      class="md:w-72"
    />

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :description="errorMessage"
    />

    <!-- Une ligne par jeu (SPEC-020, R1) : un clic ouvre sa page -->
    <ul v-if="rows.length" class="divide-y divide-gray-100 rounded border border-gray-200">
      <li
        v-for="row in rows"
        :key="row.game.id"
        class="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
        :aria-label="row.game.title"
      >
        <div class="min-w-0 space-y-1">
          <NuxtLink :to="`/registrations/${row.game.slug}`" class="font-medium text-gray-900 hover:underline">
            {{ row.game.title }}
          </NuxtLink>
          <div class="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <UBadge :color="row.state.color" variant="subtle">{{ row.state.label }}</UBadge>
            <span v-if="row.period">{{ plural(row.pool, 'personne') }} dans le vivier</span>
          </div>
        </div>
        <UButton
          v-if="!row.period"
          icon="i-heroicons-plus"
          color="primary"
          variant="soft"
          size="sm"
          :to="`/registrations/${row.game.slug}`"
        >
          Créer le vivier
        </UButton>
      </li>
    </ul>
    <p v-else-if="loaded && !errorMessage" class="text-sm text-gray-500">
      Aucun jeu à afficher.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useGameFocus } from '@/composables/useGameFocus'
import { isArchivedGame } from '~/utils/games'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import { plural, type RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'
import { REGISTRATION_PERIOD_STATE_META, REGISTRATION_STATUSES, metaOf } from '~/utils/domain'
import { REGISTRATION_PERIODS_READ } from '~/utils/offlinePlan'

// Résumé des inscriptions de ses jeux (SPEC-020, R1) ; avec un jeu actif, la page de ce jeu (R3)
const { game: selectedGame } = useGameFocus()
const games = ref<ApiResponse<'/api/games'>>([])
const periods = ref<RegistrationPeriod[]>([])
const showArchived = ref(false)
const errorMessage = ref('')
const loaded = ref(false)

const NO_PERIOD = { label: 'Pas de vivier', color: 'neutral' } as const

// Le jeu actif ne garde que son identifiant : sa page s'ouvre une fois la liste des jeux lue
const focusedSlug = computed(() => games.value.find((game) => game.id === selectedGame.value?.id)?.slug)
watch(focusedSlug, (slug) => {
  if (slug) void navigateTo(`/registrations/${slug}`, { replace: true })
}, { immediate: true })

// Lisible hors ligne depuis sa dernière lecture (US-119)
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

const rows = computed(() => {
  const byGame = new Map(periods.value.map((period) => [period.gameId, period]))
  return games.value
    .filter((game) => showArchived.value || !isArchivedGame(game))
    .sort((left, right) => left.title.localeCompare(right.title, 'fr'))
    .map((game) => {
      const period = byGame.get(game.id)
      return {
        game,
        period,
        state: period ? metaOf(REGISTRATION_PERIOD_STATE_META, period.state) ?? REGISTRATION_PERIOD_STATE_META.draft : NO_PERIOD,
        pool: period ? period.registrations.filter((registration) => registration.status === REGISTRATION_STATUSES.received).length : 0
      }
    })
})
</script>
