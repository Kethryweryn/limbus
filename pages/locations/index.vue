<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Lieux</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton v-if="!isOffline" icon="i-heroicons-plus" color="primary" @click="startCreate">
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
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard v-for="location in filteredLocations" :key="location.id">
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="font-semibold truncate">{{ location.name }}</h2>
              <p class="text-sm text-gray-500 truncate">{{ location.game?.title || 'Jeu inconnu' }}</p>
            </div>
            <div v-if="!isOffline" class="flex gap-2">
              <UButton size="xs" color="primary" @click="startEdit(location)">Modifier</UButton>
              <UButton size="xs" color="error" @click="deleteLocation(location.id)">Supprimer</UButton>
            </div>
          </div>
        </template>

        <div class="space-y-2 text-sm">
          <div v-if="location.address">
            <span class="text-gray-500">Adresse</span>
            <div class="whitespace-pre-line">{{ location.address }}</div>
          </div>
          <div v-if="location.notes">
            <span class="text-gray-500">Notes</span>
            <div class="whitespace-pre-line">{{ location.notes }}</div>
          </div>
        </div>
      </UCard>
    </div>

    <USlideover v-model:open="showFormSlideover">
      <template #body>
      <div class="p-4">
        <LocationForm
          v-if="activeFormLocation"
          v-model:location="activeFormLocation"
          :games="games"
          :mode="formMode"
          @submit="handleLocationFormSubmit"
          @cancel="closeFormSlideover"
        />
      </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import LocationForm from '@/components/LocationForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { getFromStore, saveToStore } from '~/utils/storage'

const locations = ref([])
const games = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormLocation = ref(null)
const formMode = ref('create')
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
    .filter((location) =>
      [location.name, location.address, location.notes, location.game?.title].some((field) =>
        field?.toLowerCase().includes(term)
      )
    )
})

const fetchLocations = async () => {
  if (!navigator.onLine) {
    locations.value = await getFromStore('locations', 'list') || []
    return
  }

  const data = await useApiFetch('/api/locations')
  locations.value = data
  await saveToStore('locations', 'list', data)
}

const fetchGames = async () => {
  if (!navigator.onLine) {
    games.value = await getFromStore('games', 'list') || []
    return
  }

  const data = await useApiFetch('/api/games')
  games.value = data
  await saveToStore('games', 'list', data)
}

const refreshData = async () => {
  await Promise.all([fetchLocations(), fetchGames()])
}

const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = !navigator.onLine

  if (isOffline.value) {
    closeFormSlideover()
  }

  if (wasOffline && !isOffline.value) {
    refreshData()
  }
}

onMounted(async () => {
  updateStatus()
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
  await refreshData()
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
})

function startCreate() {
  if (isOffline.value) return

  activeFormLocation.value = {
    name: '',
    address: '',
    notes: '',
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    published: true
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(location) {
  if (isOffline.value) return

  activeFormLocation.value = { ...location }
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormLocation.value = null
  showFormSlideover.value = false
}

async function handleLocationFormSubmit() {
  if (isOffline.value) return

  if (formMode.value === 'create') {
    await useApiFetch('/api/locations', {
      method: 'POST',
      body: activeFormLocation.value
    })
  } else {
    await useApiFetch(`/api/locations/${activeFormLocation.value.id}/put`, {
      method: 'POST',
      body: activeFormLocation.value
    })
  }

  closeFormSlideover()
  await fetchLocations()
}

async function deleteLocation(id) {
  if (isOffline.value) return

  if (!confirm('Supprimer ce lieu ? Les sessions liees seront conservees sans lieu.')) return

  await useApiFetch(`/api/locations/${id}/delete`, { method: 'POST' })
  await fetchLocations()
}
</script>
