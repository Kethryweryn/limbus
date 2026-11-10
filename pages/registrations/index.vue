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
          <p v-if="row.toHandle" class="text-sm text-warning-700" data-to-handle>{{ row.toHandle }}</p>
        </div>
        <UButton
          v-if="!row.period"
          icon="i-heroicons-plus"
          color="primary"
          variant="soft"
          size="sm"
          @click="creating = { id: row.game.id, slug: row.game.slug }"
        >
          Créer le vivier
        </UButton>
      </li>
    </ul>
    <RegistrationPeriodForm v-if="creating" v-model:open="showForm" :game-id="creating.id" :period="null" @saved="created" />
    <p v-else-if="loaded && !errorMessage" class="text-sm text-gray-500">
      Aucun jeu à afficher.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useGameFocus } from '@/composables/useGameFocus'
import { isArchivedGame } from '~/utils/games'
import { useRegistrationLists } from '~/composables/useRegistrationLists'
import { plural, type RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'
import { SESSION_STATUSES } from '~/utils/domain'
import { periodStateMeta, poolOf, sumToHandle, toHandleBySession, toHandleText } from '~/utils/registrations'

// Résumé des inscriptions de ses jeux (SPEC-020, R1) ; avec un jeu actif, la page de ce jeu (R3)
const { game: selectedGame } = useGameFocus()
const { games, periods, errorMessage, loaded } = useRegistrationLists()
const showArchived = ref(false)
// Jeu sans vivier dont on crée le vivier depuis sa ligne ; une fois créé, sa page s'ouvre
const creating = ref<{ id: string, slug: string } | null>(null)
const showForm = computed({
  get: () => creating.value !== null,
  set: (open) => { if (!open) creating.value = null }
})

const NO_PERIOD = { label: 'Pas de vivier', color: 'neutral' } as const

// Sessions prévues proposées au vivier : celles où il reste à traiter (R2) ; une session sans lien au vivier n'a personne
const scheduledSessions = (period: RegistrationPeriod) => period.sessions
  .filter((link) => link.session.status === SESSION_STATUSES.scheduled)
  .map((link) => ({ id: link.sessionId, castAnnouncedAt: link.castAnnouncedAt }))

// Le jeu actif ne garde que son identifiant : sa page s'ouvre une fois la liste des jeux lue
const focusedSlug = computed(() => games.value.find((game) => game.id === selectedGame.value?.id)?.slug)
watch(focusedSlug, (slug) => {
  if (slug) void navigateTo(`/registrations/${slug}`, { replace: true })
}, { immediate: true })

function created() {
  const slug = creating.value?.slug
  creating.value = null
  if (slug) void navigateTo(`/registrations/${slug}`)
}

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
        state: period ? periodStateMeta(period.state) : NO_PERIOD,
        pool: period ? poolOf(period.registrations).length : 0,
        toHandle: period ? toHandleText(sumToHandle(toHandleBySession(period.registrations, scheduledSessions(period)).values())) : ''
      }
    })
})
</script>
