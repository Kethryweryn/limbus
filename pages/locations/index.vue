<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Lieux</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer un lieu
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un lieu..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
      <AppCheckboxRow v-if="!selectedGame" v-model="showArchived" label="Afficher les archives" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <ContentCard
        v-for="location in paginatedLocations"
        :key="location.id"
        :to="`/locations/${location.slug}`"
      >
        <template #header>
          <div class="space-y-2">
            <h2 class="text-lg font-semibold leading-tight">{{ location.name }}</h2>
            <div class="flex flex-wrap gap-1">
              <UBadge color="neutral" variant="subtle" size="xs" class="max-w-full truncate">
                {{ location.game?.title || 'Jeu inconnu' }}
              </UBadge>
              <UBadge v-if="isInArchivedGame(location)" color="neutral" variant="solid" size="xs">
                Archivé
              </UBadge>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <div class="space-y-2 text-sm">
            <div v-if="location.address">
              <span class="text-gray-500">Adresse</span>
              <div class="whitespace-pre-line line-clamp-3">{{ location.address }}</div>
            </div>
            <div v-if="location.notes">
              <span class="text-gray-500">Notes</span>
              <div class="whitespace-pre-line line-clamp-4">{{ location.notes }}</div>
            </div>
            <p v-if="!location.address && !location.notes" class="text-gray-600">Aucune adresse ni note renseignée.</p>
          </div>

          <div class="flex flex-wrap gap-2 pt-1">
            <UButton icon="i-heroicons-pencil-square" size="xs" color="primary" @click.stop="startEdit(location)">
              Modifier
            </UButton>
            <UButton icon="i-heroicons-trash" size="xs" color="error" variant="soft" @click.stop="deleteLocation(location.id)">
              Supprimer
            </UButton>
          </div>
        </div>
      </ContentCard>
    </div>

    <div class="flex items-center justify-center gap-4 mt-6">
      <UButton :disabled="page === 1" @click="prevPage">← Précédent</UButton>
      <span class="inline-flex items-center text-sm text-gray-500">Page {{ page }} / {{ totalPages }}</span>
      <UButton :disabled="page === totalPages" @click="nextPage">Suivant →</UButton>
    </div>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier le lieu' : 'Créer un lieu'"
      :full-page-to="formMode === 'edit' && activeFormLocation?.slug ? `/locations/${activeFormLocation.slug}?edit=1` : null"
      @close="closeFormSlideover"
      @full-page="showFormSlideover = false"
    >
      <LocationForm
        v-if="activeFormLocation"
        v-model:location="activeFormLocation"
        :games="games"
        :mode="formMode"
        @submit="handleLocationFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>
  </div>
</template>

<script setup lang="ts">
import { DELETE_CONFIRMATIONS } from '~/utils/deleteConfirmations'
import { confirmedDelete } from '~/composables/useConfirmedDelete'
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import { isInArchivedGame, isVisibleContent } from '~/utils/games'
import { computed, onMounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import LocationForm from '@/components/LocationForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { LocationDraft } from '~/utils/writingDrafts'

type LocationRow = ApiResponse<'/api/locations'>[number]

const locations = ref<LocationRow[]>([])
const games = ref<ApiResponse<'/api/games'>>([])
const searchQuery = ref('')
const gameFilter = ref('all')
const showArchived = ref(false)
const showFormSlideover = ref(false)
const activeFormLocation = ref<LocationDraft | null>(null)
const formMode = ref<'create' | 'edit'>('create')
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const filteredLocations = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  return locations.value
    .filter((location) => !gameId || location.gameId === gameId)
    .filter((location) => isVisibleContent(location, gameId, showArchived.value))
    .filter((location) =>
      [location.name, location.address, location.notes, location.game?.title].some((field) =>
        field?.toLowerCase().includes(term)
      )
    )
    // Dernier modifié en tête, comme les autres listes du jeu
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
})

const page = ref(1)
const itemsPerPage = 9

const paginatedLocations = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredLocations.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLocations.value.length / itemsPerPage)))

const nextPage = () => {
  if (page.value < totalPages.value) page.value++
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

watch([searchQuery, gameFilter, filteredLocations], () => {
  page.value = 1
})

const fetchLocations = async () => {
  locations.value = await fetchOfflineList('locations', '/api/locations')
}

const fetchGames = async () => {
  games.value = await fetchOfflineList('games', '/api/games')
}

const refreshData = async () => {
  await Promise.all([fetchLocations(), fetchGames()])
}

useConnectionRefresh(refreshData)

onMounted(async () => {
  await refreshData()
})

function startCreate() {
  activeFormLocation.value = {
    name: '',
    address: '',
    notes: '',
    gameId: selectedGame.value?.id || games.value[0]?.id || ''
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(location: LocationRow) {
  activeFormLocation.value = { ...location }
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormLocation.value = null
  showFormSlideover.value = false
}

async function handleLocationFormSubmit() {
  if (!activeFormLocation.value) return
  if (formMode.value === 'create') {
    await useApiFetch('/api/locations', {
      method: 'POST',
      body: activeFormLocation.value
    })
  } else {
    await useApiFetch(`/api/locations/${activeFormLocation.value.id}`, {
      method: 'PUT',
      body: activeFormLocation.value
    })
  }

  closeFormSlideover()
  await fetchLocations()
}

async function deleteLocation(id: string) {
  if (await confirmedDelete(`/api/locations/${id}`, DELETE_CONFIRMATIONS.location)) await fetchLocations()
}
</script>
