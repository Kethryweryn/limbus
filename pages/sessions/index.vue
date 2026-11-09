<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Sessions</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer une session
      </UButton>
    </div>

    <UAlert v-if="deleteError" color="error" variant="soft" :description="deleteError" class="mb-4" />

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher une session..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
      <USelect
        v-model="periodFilter"
        :items="periodFilterOptions"
        value-key="value"
        class="w-full md:w-48"
      />
    </div>

    <div class="space-y-8">
      <section v-for="section in sessionSections" :key="section.key" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">{{ section.title }}</h2>
          <span class="text-sm text-gray-500">{{ section.sessions.length }} session(s)</span>
        </div>

        <SessionCard
          v-for="session in paginatedSectionSessions(section)"
          :key="session.id"
          :session="session"
          @edit="startEdit(session)"
          @delete="deleteSession(session.id)"
          @preview="openPhotoPreview"
        />

        <UCard v-if="section.sessions.length === 0">
          <div class="text-sm text-gray-500">Aucune session dans cette période.</div>
        </UCard>

        <div v-else class="flex items-center justify-center gap-4 mt-4">
          <UButton color="neutral" variant="soft" :disabled="sectionPage(section.key) === 1" @click="prevSectionPage(section.key)">← Précédent</UButton>
          <span class="inline-flex items-center text-sm text-gray-500">
            Page {{ sectionPage(section.key) }} / {{ totalSectionPages(section) }}
          </span>
          <UButton color="neutral" variant="soft" :disabled="sectionPage(section.key) === totalSectionPages(section)" @click="nextSectionPage(section)">Suivant →</UButton>
        </div>
      </section>
    </div>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier la session' : 'Créer une session'"
      :full-page-to="formMode === 'edit' && activeFormSession?.slug ? `/sessions/${activeFormSession.slug}?edit=details` : null"
      @close="closeFormSlideover"
      @full-page="showFormSlideover = false"
    >
      <SessionForm
        v-if="activeFormSession"
        v-model:session="activeFormSession"
        :games="games"
        :characters="characters"
        :locations="locations"
        :participants="participants"
        :mode="formMode"
        @submit="handleSessionFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>

    <UModal v-model:open="showPhotoPreview">
      <template #body>
        <div class="flex justify-center p-2">
          <img
            v-if="previewPhotoUrl"
            :src="previewPhotoUrl"
            alt=""
            class="max-h-[80vh] max-w-full rounded object-contain"
          >
        </div>
      </template>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import { computed, onMounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import SessionForm from '@/components/SessionForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { SESSION_STATUSES, isClosedSessionStatus } from '~/utils/domain'
import { DELETE_CONFIRMATIONS } from '~/utils/deleteConfirmations'
import { apiErrorMessage } from '~/utils/apiErrors'
import { sessionFormPayload } from '~/utils/sessions'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { SessionDraft } from '~/utils/writingDrafts'

type SessionRow = ApiResponse<'/api/sessions'>[number]
type Section = { key: 'future' | 'past', title: string, sessions: SessionRow[] }

const sessions = ref<SessionRow[]>([])
const games = ref<ApiResponse<'/api/games'>>([])
const characters = ref<ApiResponse<'/api/characters'>>([])
const locations = ref<ApiResponse<'/api/locations'>>([])
const participants = ref<ApiResponse<'/api/participants'>>([])
const searchQuery = ref('')
const deleteError = ref('')
const gameFilter = ref('all')
const periodFilter = ref('future')
const showFormSlideover = ref(false)
const activeFormSession = ref<SessionDraft | null>(null)
const formMode = ref<'create' | 'edit'>('create')
const showPhotoPreview = ref(false)
const previewPhotoUrl = ref('')
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const periodFilterOptions = [
  { label: 'Futur', value: 'future' },
  { label: 'Passé', value: 'past' },
  { label: 'Tout', value: 'all' }
]

const filteredSessions = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  return sessions.value
    .filter((session) => !gameId || session.gameId === gameId)
    .filter((session) =>
      [session.name, session.location?.name, session.location?.address, session.game?.title].some((field) =>
        field?.toLowerCase().includes(term)
      )
    )
})

const sessionTime = (session: SessionRow) => session.date ? new Date(session.date).getTime() : Number.POSITIVE_INFINITY
const nowTime = computed(() => Date.now())

const futureSessions = computed(() =>
  filteredSessions.value
    .filter((session) => !isClosedSessionStatus(session.status) && (!session.date || sessionTime(session) >= nowTime.value))
    .sort((a, b) => sessionTime(a) - sessionTime(b))
)

const pastSessions = computed(() =>
  filteredSessions.value
    // Annulée ou terminée : rangée avec les passées, quelle que soit sa date (US-020)
    .filter((session) => isClosedSessionStatus(session.status) || (session.date && sessionTime(session) < nowTime.value))
    .sort((a, b) => sessionTime(b) - sessionTime(a))
)

const sessionSections = computed<Section[]>(() => {
  if (periodFilter.value === 'future') {
    return [{ key: 'future', title: 'Sessions à venir', sessions: futureSessions.value }]
  }
  if (periodFilter.value === 'past') {
    return [{ key: 'past', title: 'Sessions passées', sessions: pastSessions.value }]
  }

  return [
    { key: 'future', title: 'Sessions à venir', sessions: futureSessions.value },
    { key: 'past', title: 'Sessions passées', sessions: pastSessions.value }
  ]
})

const sessionPages = ref<Record<Section['key'], number>>({
  future: 1,
  past: 1
})
const sessionItemsPerPage = 5

const sectionPage = (key: Section['key']) => sessionPages.value[key] || 1

const totalSectionPages = (section: Section) => Math.max(1, Math.ceil(section.sessions.length / sessionItemsPerPage))

const paginatedSectionSessions = (section: Section) => {
  const start = (sectionPage(section.key) - 1) * sessionItemsPerPage
  return section.sessions.slice(start, start + sessionItemsPerPage)
}

const nextSectionPage = (section: Section) => {
  const key = section.key
  if (sectionPage(key) < totalSectionPages(section)) {
    sessionPages.value[key] = sectionPage(key) + 1
  }
}

const prevSectionPage = (key: Section['key']) => {
  if (sectionPage(key) > 1) {
    sessionPages.value[key] = sectionPage(key) - 1
  }
}

watch([searchQuery, gameFilter, periodFilter, filteredSessions], () => {
  sessionPages.value = {
    future: 1,
    past: 1
  }
})

function openPhotoPreview(photoUrl: string) {
  previewPhotoUrl.value = photoUrl
  showPhotoPreview.value = true
}

const fetchSessions = async () => {
  sessions.value = await fetchOfflineList('sessions', '/api/sessions')
}

const fetchGames = async () => {
  games.value = await fetchOfflineList('games', '/api/games')
}

const fetchCharacters = async () => {
  characters.value = await fetchOfflineList('characters', '/api/characters')
}

const fetchLocations = async () => {
  locations.value = await fetchOfflineList('locations', '/api/locations')
}

const fetchParticipants = async () => {
  participants.value = await fetchOfflineList('participants', '/api/participants')
}

const refreshData = async () => {
  await Promise.all([fetchSessions(), fetchGames(), fetchCharacters(), fetchLocations(), fetchParticipants()])
}

useConnectionRefresh(refreshData)

onMounted(async () => {
  await refreshData()
})

function startCreate() {
  activeFormSession.value = {
    name: '',
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    date: '',
    locationId: '',
    status: SESSION_STATUSES.scheduled,
    published: false,
    organizerIds: [],
    npcIds: [],
    kitchenIds: [],
    participants: [],
    assignments: []
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(session: SessionRow) {
  activeFormSession.value = sessionFormPayload(session)
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormSession.value = null
  showFormSlideover.value = false
}

async function handleSessionFormSubmit() {
  if (!activeFormSession.value) return
  if (formMode.value === 'create') {
    await useApiFetch('/api/sessions', {
      method: 'POST',
      body: activeFormSession.value
    })
  } else {
    await useApiFetch(`/api/sessions/${activeFormSession.value.id}`, {
      method: 'PUT',
      body: activeFormSession.value
    })
  }

  closeFormSlideover()
  await fetchSessions()
}

async function deleteSession(id: string) {
  if (!confirm(DELETE_CONFIRMATIONS.session)) return

  deleteError.value = ''
  try {
    await useApiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
  } catch (error) {
    // Paiements ou inscriptions : refus qui oriente vers l'annulation ou le report (US-021)
    deleteError.value = apiErrorMessage(error, 'Impossible de supprimer la session')
    return
  }
  await fetchSessions()
}
</script>
