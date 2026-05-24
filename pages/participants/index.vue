<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Participants</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer un participant
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un participant..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard v-for="participant in paginatedParticipants" :key="participant.id">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar icon="i-heroicons-user" />
              <div class="min-w-0">
                <NuxtLink :to="`/participants/${participant.id}`" class="font-semibold truncate hover:underline">
                  {{ participant.name }}
                </NuxtLink>
                <div class="flex flex-wrap gap-1 mt-1" :title="formatParticipantGames(participant)">
                  <UBadge
                    v-for="game in visibleParticipantGames(participant)"
                    :key="game.id"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                    class="max-w-40 truncate"
                  >
                    {{ game.title }}
                  </UBadge>
                  <UBadge
                    v-if="hiddenParticipantGamesCount(participant) > 0"
                    color="neutral"
                    variant="outline"
                    size="xs"
                  >
                    +{{ hiddenParticipantGamesCount(participant) }}
                  </UBadge>
                  <span v-if="!participant.games?.length" class="text-sm text-gray-500">Aucun jeu</span>
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <UButton size="xs" color="primary" @click="startEdit(participant)">Modifier</UButton>
              <UButton size="xs" color="error" @click="deleteParticipant(participant.id)">Supprimer</UButton>
            </div>
          </div>
        </template>

        <div class="space-y-2 text-sm">
          <div v-if="participant.email">
            <span class="text-gray-500">Email</span>
            <div>{{ participant.email }}</div>
          </div>
          <div v-if="participant.phone">
            <span class="text-gray-500">Téléphone</span>
            <div>{{ participant.phone }}</div>
          </div>
          <div v-if="participant.notes">
            <span class="text-gray-500">Notes</span>
            <div>{{ participant.notes }}</div>
          </div>
        </div>
      </UCard>
    </div>

    <div class="flex items-center justify-center gap-4 mt-6">
      <UButton @click="prevPage" :disabled="page === 1">← Précédent</UButton>
      <span class="inline-flex items-center text-sm text-gray-500">Page {{ page }} / {{ totalPages }}</span>
      <UButton @click="nextPage" :disabled="page === totalPages">Suivant →</UButton>
    </div>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier le participant' : 'Créer un participant'"
      :full-page-to="formMode === 'edit' && activeFormParticipant?.id ? `/participants/${activeFormParticipant.id}?edit=1` : null"
      @close="closeFormSlideover"
      @full-page="showFormSlideover = false"
    >
      <ParticipantForm
        v-if="activeFormParticipant"
        v-model:participant="activeFormParticipant"
        :games="games"
        :mode="formMode"
        @submit="handleParticipantFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import ParticipantForm from '@/components/ParticipantForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const participants = ref([])
const games = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormParticipant = ref(null)
const formMode = ref('create')
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const filteredParticipants = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  return participants.value
    .filter((participant) => !gameId || participant.games?.some((game) => game.id === gameId))
    .filter((participant) =>
      [participant.name, participant.email, participant.phone, ...(participant.games || []).map((game) => game.title)].some((field) =>
        field?.toLowerCase().includes(term)
      )
    )
})

const page = ref(1)
const itemsPerPage = 9

const paginatedParticipants = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredParticipants.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredParticipants.value.length / itemsPerPage)))

const nextPage = () => {
  if (page.value < totalPages.value) page.value++
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

watch([searchQuery, gameFilter, filteredParticipants], () => {
  page.value = 1
})

const formatParticipantGames = (participant) => {
  if (!participant.games?.length) return 'Aucun jeu'
  return participant.games.map((game) => game.title).join(', ')
}

const visibleParticipantGames = (participant) => participant.games?.slice(0, 2) || []

const hiddenParticipantGamesCount = (participant) => Math.max((participant.games?.length || 0) - visibleParticipantGames(participant).length, 0)

const fetchParticipants = async () => {
  if (isOfflineMode()) {
    participants.value = await getFromStore('participants', 'list') || []
    return
  }

  const data = await useApiFetch('/api/participants')
  participants.value = data
  await saveToStore('participants', 'list', data)
}

const fetchGames = async () => {
  if (isOfflineMode()) {
    games.value = await getFromStore('games', 'list') || []
    return
  }

  const data = await useApiFetch('/api/games')
  games.value = data
  await saveToStore('games', 'list', data)
}

const refreshData = async () => {
  await Promise.all([fetchParticipants(), fetchGames()])
}

const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = isOfflineMode()

  if (wasOffline && !isOffline.value) {
    refreshData()
  }
  if (!wasOffline && isOffline.value) {
    refreshData()
  }
}

onMounted(async () => {
  updateStatus()
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
  window.addEventListener('limbus:connection-change', updateStatus)
  await refreshData()
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
  window.removeEventListener('limbus:connection-change', updateStatus)
})

function startCreate() {
  activeFormParticipant.value = {
    name: '',
    email: '',
    phone: '',
    notes: '',
    gameIds: selectedGame.value?.id ? [selectedGame.value.id] : [],
    published: true
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(participant) {
  activeFormParticipant.value = {
    ...participant,
    gameIds: participant.games?.map((game) => game.id) || []
  }
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormParticipant.value = null
  showFormSlideover.value = false
}

async function handleParticipantFormSubmit() {
  if (formMode.value === 'create') {
    await useApiFetch('/api/participants', {
      method: 'POST',
      body: activeFormParticipant.value
    })
  } else {
    await useApiFetch(`/api/participants/${activeFormParticipant.value.id}`, {
      method: 'PUT',
      body: activeFormParticipant.value
    })
  }

  closeFormSlideover()
  await fetchParticipants()
}

async function deleteParticipant(id) {
  if (!confirm('Supprimer ce participant ? Les assignations de session seront conservées sans participant.')) return

  await useApiFetch(`/api/participants/${id}`, { method: 'DELETE' })
  await fetchParticipants()
}
</script>



