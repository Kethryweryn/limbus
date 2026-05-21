<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Joueurs</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton v-if="!isOffline" icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer un joueur
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un joueur..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :options="gameFilterOptions"
        option-attribute="label"
        value-attribute="value"
        class="w-full md:w-64"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard v-for="player in filteredPlayers" :key="player.id">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar icon="i-heroicons-user" />
              <div class="min-w-0">
                <h2 class="font-semibold truncate">{{ player.name }}</h2>
                <p class="text-sm text-gray-500 truncate">{{ player.game?.title || 'Jeu inconnu' }}</p>
              </div>
            </div>
            <div v-if="!isOffline" class="flex gap-2">
              <UButton size="xs" color="blue" @click="startEdit(player)">Modifier</UButton>
              <UButton size="xs" color="red" @click="deletePlayer(player.id)">Supprimer</UButton>
            </div>
          </div>
        </template>

        <div class="space-y-2 text-sm">
          <div v-if="player.email">
            <span class="text-gray-500">Email</span>
            <div>{{ player.email }}</div>
          </div>
          <div v-if="player.phone">
            <span class="text-gray-500">Telephone</span>
            <div>{{ player.phone }}</div>
          </div>
          <div v-if="player.notes">
            <span class="text-gray-500">Notes</span>
            <div>{{ player.notes }}</div>
          </div>
        </div>
      </UCard>
    </div>

    <USlideover v-model="showFormSlideover">
      <div class="p-4">
        <PlayerForm
          v-if="activeFormPlayer"
          v-model:player="activeFormPlayer"
          :games="games"
          :mode="formMode"
          @submit="handlePlayerFormSubmit"
          @cancel="closeFormSlideover"
        />
      </div>
    </USlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import PlayerForm from '@/components/PlayerForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { getFromStore, saveToStore } from '~/utils/storage'

const players = ref([])
const games = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormPlayer = ref(null)
const formMode = ref('create')
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const filteredPlayers = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  return players.value
    .filter((player) => !gameId || player.gameId === gameId)
    .filter((player) =>
      [player.name, player.email, player.phone, player.game?.title].some((field) =>
        field?.toLowerCase().includes(term)
      )
    )
})

const fetchPlayers = async () => {
  if (!navigator.onLine) {
    players.value = await getFromStore('players', 'list') || []
    return
  }

  const data = await useApiFetch('/api/players')
  players.value = data
  await saveToStore('players', 'list', data)
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
  await Promise.all([fetchPlayers(), fetchGames()])
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

  activeFormPlayer.value = {
    name: '',
    email: '',
    phone: '',
    notes: '',
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    published: true
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(player) {
  if (isOffline.value) return

  activeFormPlayer.value = { ...player }
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormPlayer.value = null
  showFormSlideover.value = false
}

async function handlePlayerFormSubmit() {
  if (isOffline.value) return

  if (formMode.value === 'create') {
    await useApiFetch('/api/players', {
      method: 'POST',
      body: activeFormPlayer.value
    })
  } else {
    await useApiFetch(`/api/players/${activeFormPlayer.value.id}/put`, {
      method: 'POST',
      body: activeFormPlayer.value
    })
  }

  closeFormSlideover()
  await fetchPlayers()
}

async function deletePlayer(id) {
  if (isOffline.value) return

  if (!confirm('Supprimer ce joueur ? Les assignations de session seront conservees sans joueur.')) return

  await useApiFetch(`/api/players/${id}/delete`, { method: 'POST' })
  await fetchPlayers()
}
</script>
