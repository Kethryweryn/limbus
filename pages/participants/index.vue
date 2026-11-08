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
      <!-- Toute la carte ouvre la fiche, comme les autres listes (US-179) ; le lien du nom reste pour le clavier -->
      <UCard
        v-for="participant in paginatedParticipants"
        :key="participant.id"
        class="cursor-pointer transition-shadow hover:shadow-md"
        @click="openParticipant(participant)"
      >
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar icon="i-heroicons-user" />
              <div class="min-w-0">
                <NuxtLink :to="`/participants/${participant.slug}`" class="block font-semibold truncate hover:underline" @click.stop>
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
            <div class="flex gap-2" @click.stop>
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
          <div v-for="game in gamesWithNotes(participant)" :key="game.id">
            <span class="text-gray-500">Notes — {{ game.title }}</span>
            <div class="whitespace-pre-line">{{ participant.gameNotes[game.id] }}</div>
          </div>
        </div>
      </UCard>
    </div>

    <div class="flex items-center justify-center gap-4 mt-6">
      <UButton :disabled="page === 1" @click="prevPage">← Précédent</UButton>
      <span class="inline-flex items-center text-sm text-gray-500">Page {{ page }} / {{ totalPages }}</span>
      <UButton :disabled="page === totalPages" @click="nextPage">Suivant →</UButton>
    </div>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier le participant' : 'Créer un participant'"
      :full-page-to="formMode === 'edit' && activeFormParticipant?.slug ? `/participants/${activeFormParticipant.slug}?edit=1` : null"
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

<script setup lang="ts">
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import { computed, onMounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import ParticipantForm from '@/components/ParticipantForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { ParticipantDraft } from '~/utils/writingDrafts'

type ParticipantRow = ApiResponse<'/api/participants'>[number]

const participants = ref<ParticipantRow[]>([])
const games = ref<ApiResponse<'/api/games'>>([])
const searchQuery = ref('')
const gameFilter = ref('all')
const showFormSlideover = ref(false)
const activeFormParticipant = ref<ParticipantDraft | null>(null)
const formMode = ref<'create' | 'edit'>('create')
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const filteredParticipants = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  return participants.value
    .filter((participant) => !gameId || participant.games.some((game) => game.id === gameId))
    .filter((participant) =>
      [participant.name, participant.email, participant.phone, ...participant.games.map((game) => game.title)].some((field) =>
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

const formatParticipantGames = (participant: ParticipantRow) => {
  if (!participant.games.length) return 'Aucun jeu'
  return participant.games.map((game) => game.title).join(', ')
}

// Notes de chaque jeu accessible, s'il y en a (US-069)
const gamesWithNotes = (participant: ParticipantRow) => participant.games.filter((game) => participant.gameNotes[game.id])
const visibleParticipantGames = (participant: ParticipantRow) => participant.games.slice(0, 2)

const hiddenParticipantGamesCount = (participant: ParticipantRow) => Math.max(participant.games.length - visibleParticipantGames(participant).length, 0)

const fetchParticipants = async () => {
  participants.value = await fetchOfflineList('participants', '/api/participants')
}

const fetchGames = async () => {
  games.value = await fetchOfflineList('games', '/api/games')
}

const refreshData = async () => {
  await Promise.all([fetchParticipants(), fetchGames()])
}

useConnectionRefresh(refreshData)

onMounted(async () => {
  await refreshData()
})

function startCreate() {
  activeFormParticipant.value = {
    name: '',
    email: '',
    phone: '',
    gameNotes: {},
    gameIds: selectedGame.value?.id ? [selectedGame.value.id] : []
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function openParticipant(participant: ParticipantRow) {
  void navigateTo(`/participants/${participant.slug}`)
}

function startEdit(participant: ParticipantRow) {
  activeFormParticipant.value = {
    ...participant,
    gameIds: participant.games.map((game) => game.id)
  }
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormParticipant.value = null
  showFormSlideover.value = false
}

async function handleParticipantFormSubmit() {
  if (!activeFormParticipant.value) return
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

async function deleteParticipant(id: string) {
  if (!confirm('Supprimer définitivement ce participant et ses données (coordonnées, photos, paiements, envois) ? Les rôles de session restent, sans participant. Les trombinoscopes où figurait sa photo devront être régénérés.')) return

  await useApiFetch(`/api/participants/${id}`, { method: 'DELETE' })
  await fetchParticipants()
}
</script>



