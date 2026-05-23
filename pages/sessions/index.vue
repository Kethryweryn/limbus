<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Sessions</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton v-if="!isOffline" icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer une session
      </UButton>
    </div>

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

        <UCard v-for="session in paginatedSectionSessions(section)" :key="session.id" class="mb-4">
          <template #header>
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 class="font-semibold">{{ session.name }}</h3>
                <p class="text-sm text-gray-500">
                  {{ session.game?.title || 'Jeu inconnu' }}
                  <span v-if="session.date"> · {{ formatDate(session.date) }}</span>
                  <span v-if="session.location"> · {{ session.location.name }}</span>
                </p>
              </div>
              <div class="flex flex-col items-start md:items-end gap-2">
                <div>
                  <UBadge :color="statusMeta(session.status).color" variant="subtle" size="xs">
                    {{ statusMeta(session.status).label }}
                  </UBadge>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UButton v-if="!isOffline" size="xs" color="primary" :to="`/sessions/${session.id}`">
                    Cast
                  </UButton>
                  <UButton v-if="!isOffline" size="xs" color="primary" variant="soft" :to="`/sessions/${session.id}?tab=timeline`">
                    Timeline
                  </UButton>
                  <UButton v-if="!isOffline" size="xs" color="primary" variant="soft" :to="`/sessions/${session.id}?tab=documents`">
                    Documents
                  </UButton>
                  <UButton v-if="!isOffline" size="xs" color="primary" @click="startEdit(session)">Organisation</UButton>
                  <UButton v-if="!isOffline" size="xs" color="error" @click="deleteSession(session.id)">Supprimer</UButton>
                </div>
              </div>
            </div>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Lieu</span>
              <div class="font-medium">
                {{ session.location ? formatLocation(session.location) : 'Non renseigné' }}
              </div>
            </div>
            <div>
              <span class="text-gray-500">Cast assigné</span>
              <div class="font-medium">{{ session.assignments?.length || 0 }} personnage(s)</div>
            </div>
          </div>

          <div v-if="session.assignments?.length" class="mt-4">
            <h4 class="text-sm font-semibold mb-2">Assignations</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div
                v-for="assignment in session.assignments"
                :key="assignment.id"
                class="text-sm border rounded p-2 bg-gray-50"
              >
                <div class="flex items-start gap-3">
                  <button
                    type="button"
                    class="size-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center"
                    :class="assignment.photoUrl ? 'cursor-pointer' : 'cursor-default'"
                    @click="assignment.photoUrl && openPhotoPreview(assignment.photoUrl)"
                  >
                    <img
                      v-if="assignment.photoUrl"
                      :src="assignment.photoUrl"
                      alt=""
                      class="h-full w-full object-cover"
                    >
                    <UIcon v-else name="i-heroicons-user" class="size-8 text-gray-400" />
                  </button>
                  <div class="min-w-0">
                    <div class="font-medium">{{ assignment.character?.name }}</div>
                    <div class="text-gray-600">
                      {{ assignment.participant?.name || 'Participant non assigné' }}
                      <span v-if="assignment.participant?.email"> · {{ assignment.participant.email }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="assignment.notes" class="text-gray-500">{{ assignment.notes }}</div>
              </div>
            </div>
          </div>
        </UCard>

        <UCard v-if="section.sessions.length === 0">
          <div class="text-sm text-gray-500">Aucune session dans cette période.</div>
        </UCard>

        <div v-else class="flex items-center justify-center gap-4 mt-4">
          <UButton @click="prevSectionPage(section.key)" :disabled="sectionPage(section.key) === 1">← Précédent</UButton>
          <span class="inline-flex items-center text-sm text-gray-500">
            Page {{ sectionPage(section.key) }} / {{ totalSectionPages(section) }}
          </span>
          <UButton @click="nextSectionPage(section)" :disabled="sectionPage(section.key) === totalSectionPages(section)">Suivant →</UButton>
        </div>
      </section>
    </div>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier la session' : 'Créer une session'"
      :full-page-to="formMode === 'edit' && activeFormSession?.id ? `/sessions/${activeFormSession.id}?edit=details` : null"
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
        :show-cast="false"
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

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import SessionForm from '@/components/SessionForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const sessions = ref([])
const games = ref([])
const characters = ref([])
const locations = ref([])
const participants = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const periodFilter = ref('future')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormSession = ref(null)
const formMode = ref('create')
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

const statusLabels = {
  scheduled: { label: 'Prévue', color: 'primary' },
  postponed: { label: 'Reportée', color: 'warning' },
  cancelled: { label: 'Annulée', color: 'error' },
  completed: { label: 'Terminée', color: 'success' }
}

const statusMeta = (status) => statusLabels[status] || statusLabels.scheduled

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

const sessionTime = (session) => session.date ? new Date(session.date).getTime() : Number.POSITIVE_INFINITY
const nowTime = computed(() => Date.now())

const futureSessions = computed(() =>
  filteredSessions.value
    .filter((session) => !session.date || sessionTime(session) >= nowTime.value)
    .sort((a, b) => sessionTime(a) - sessionTime(b))
)

const pastSessions = computed(() =>
  filteredSessions.value
    .filter((session) => session.date && sessionTime(session) < nowTime.value)
    .sort((a, b) => sessionTime(b) - sessionTime(a))
)

const sessionSections = computed(() => {
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

const sessionPages = ref({
  future: 1,
  past: 1
})
const sessionItemsPerPage = 5

const sectionPage = (key) => sessionPages.value[key] || 1

const totalSectionPages = (section) => Math.max(1, Math.ceil(section.sessions.length / sessionItemsPerPage))

const paginatedSectionSessions = (section) => {
  const start = (sectionPage(section.key) - 1) * sessionItemsPerPage
  return section.sessions.slice(start, start + sessionItemsPerPage)
}

const nextSectionPage = (section) => {
  const key = section.key
  if (sectionPage(key) < totalSectionPages(section)) {
    sessionPages.value[key] = sectionPage(key) + 1
  }
}

const prevSectionPage = (key) => {
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

const formatDate = (value) => new Date(value).toLocaleString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const formatLocation = (location) => {
  return location.address ? `${location.name} - ${location.address}` : location.name
}

function openPhotoPreview(photoUrl) {
  previewPhotoUrl.value = photoUrl
  showPhotoPreview.value = true
}

const fetchSessions = async () => {
  if (isOfflineMode()) {
    sessions.value = await getFromStore('sessions', 'list') || []
    return
  }

  const data = await useApiFetch('/api/sessions')
  sessions.value = data
  await saveToStore('sessions', 'list', data)
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

const fetchCharacters = async () => {
  if (isOfflineMode()) {
    characters.value = await getFromStore('characters', 'list') || []
    return
  }

  const data = await useApiFetch('/api/characters')
  characters.value = data
  await saveToStore('characters', 'list', data)
}

const fetchLocations = async () => {
  if (isOfflineMode()) {
    locations.value = await getFromStore('locations', 'list') || []
    return
  }

  const data = await useApiFetch('/api/locations')
  locations.value = data
  await saveToStore('locations', 'list', data)
}

const fetchParticipants = async () => {
  if (isOfflineMode()) {
    participants.value = await getFromStore('participants', 'list') || []
    return
  }

  const data = await useApiFetch('/api/participants')
  participants.value = data
  await saveToStore('participants', 'list', data)
}

const refreshData = async () => {
  await Promise.all([fetchSessions(), fetchGames(), fetchCharacters(), fetchLocations(), fetchParticipants()])
}

const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = isOfflineMode()

  if (isOffline.value) {
    closeFormSlideover()
  }

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

function toDatetimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function normalizeSessionForForm(session) {
  return {
    ...session,
    date: toDatetimeLocal(session.date),
    locationId: session.locationId || '',
    organizerIds: session.participants
      ?.filter((participant) => participant.role === 'organizer')
      .map((participant) => participant.participantId || participant.participant?.id)
      .filter(Boolean) || [],
    npcIds: session.participants
      ?.filter((participant) => participant.role === 'npc')
      .map((participant) => participant.participantId || participant.participant?.id)
      .filter(Boolean) || [],
    kitchenIds: session.participants
      ?.filter((participant) => participant.role === 'kitchen')
      .map((participant) => participant.participantId || participant.participant?.id)
      .filter(Boolean) || [],
    assignments: session.assignments?.map((assignment) => ({
      characterId: assignment.characterId,
      participantId: assignment.participantId || '',
      photoUrl: assignment.photoUrl || '',
      notes: assignment.notes || ''
    })) || []
  }
}

function startCreate() {
  if (isOffline.value) return

  activeFormSession.value = {
    name: '',
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    date: '',
    locationId: '',
    status: 'scheduled',
    published: true,
    organizerIds: [],
    npcIds: [],
    kitchenIds: [],
    participants: [],
    assignments: []
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(session) {
  if (isOffline.value) return

  activeFormSession.value = normalizeSessionForForm(session)
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormSession.value = null
  showFormSlideover.value = false
}

async function handleSessionFormSubmit() {
  if (isOffline.value) return

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

async function deleteSession(id) {
  if (isOffline.value) return

  if (!confirm('Supprimer cette session ?')) return

  await useApiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
  await fetchSessions()
}
</script>
