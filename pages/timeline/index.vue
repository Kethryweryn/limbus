<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Timeline</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton v-if="selectedTimelineGameId" icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer un événement
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <TimelineGameSearch
        v-if="!selectedGame"
        v-model:search="gameSearch"
        :games="games"
        :has-selection="Boolean(selectedTimelineGameId)"
        @select="selectTimelineGame"
      />
      <UBadge v-if="selectedTimelineGame && isArchivedGame(selectedTimelineGame)" color="neutral" variant="solid" class="self-center">
        Jeu archivé
      </UBadge>
      <UInput
        v-if="selectedTimelineGameId"
        v-model="searchQuery"
        placeholder="Rechercher un événement..."
        icon="i-heroicons-magnifying-glass"
      />
    </div>

    <TimelineQuickAccess v-if="!selectedTimelineGameId" :games="games" @select="selectTimelineGame" />

    <UCard v-if="!selectedTimelineGameId">
      <div class="text-sm text-gray-500">
        Sélectionnez un jeu pour afficher sa timeline.
      </div>
    </UCard>

    <div v-else-if="filteredEvents.length" class="space-y-8">
      <TimelineGrid :events="filteredEvents" @open="openEventPage" />
      <TimelineDayList :events="filteredEvents" @open="openEventPage" @edit="startEdit" @remove="deleteTimelineEvent" />
    </div>

    <UCard v-else>
      Aucun événement de timeline.
    </UCard>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier l’événement' : 'Créer un événement'"
      :full-page-to="formMode === 'edit' && activeFormEvent?.slug ? `/timeline/${activeFormEvent.slug}?edit=1` : null"
      @close="closeFormSlideover"
      @full-page="showFormSlideover = false"
    >
      <TimelineEventForm
        v-if="activeFormEvent"
        v-model:event="activeFormEvent"
        :games="games"
        :characters="characters"
        :factions="factions"
        :intrigues="intrigues"
        :items="items"
        :mode="formMode"
        @submit="handleEventFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>
  </div>
</template>

<script setup lang="ts">
import { DELETE_CONFIRMATIONS } from '~/utils/deleteConfirmations'
import { confirmedDelete } from '~/composables/useConfirmedDelete'
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import { computed, onMounted, ref, watch } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import TimelineEventForm from '@/components/TimelineEventForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import type { ApiResponse } from '~/composables/useApiFetch'
import { isArchivedGame } from '~/utils/games'
import type { TimelineEventRow, TimelineGame } from '~/utils/timeline'
import type { TimelineEventDraft } from '~/utils/writingDrafts'

// D'où l'on ouvre un événement : sa page y ramène (voir pages/timeline/[id].vue)
type ReturnContext = { source: string, gameId: string, eventId: string }

const timelineEvents = ref<TimelineEventRow[]>([])
const games = ref<TimelineGame[]>([])
const characters = ref<ApiResponse<'/api/characters'>>([])
const factions = ref<ApiResponse<'/api/factions'>>([])
const intrigues = ref<ApiResponse<'/api/intrigues'>>([])
const items = ref<ApiResponse<'/api/items'>>([])
const searchQuery = ref('')
const gameFilter = ref('')
const gameSearch = ref('')
const showFormSlideover = ref(false)
const activeFormEvent = ref<TimelineEventDraft | null>(null)
const formMode = ref<'create' | 'edit'>('create')
const router = useRouter()
const route = useRoute()
const { game: selectedGame } = useGameFocus()

const selectedTimelineGameId = computed(() => selectedGame.value?.id || gameFilter.value || '')
// Le jeu actif n'a que son identifiant et son titre : sa fiche complète (archivé ou non) vient de la liste
const selectedTimelineGame = computed(() =>
  games.value.find((game) => game.id === selectedTimelineGameId.value) || null
)

watch(gameSearch, (value) => {
  if (!selectedTimelineGame.value) return
  if (value !== selectedTimelineGame.value.title) {
    gameFilter.value = ''
  }
})

function selectTimelineGame(game: TimelineGame) {
  gameFilter.value = game.id
  gameSearch.value = game.title
  rememberTimelineGame(game.id)
}

const filteredEvents = computed(() => {
  if (!selectedTimelineGameId.value) return []

  const term = searchQuery.value.toLowerCase()

  return timelineEvents.value
    .filter((timelineEvent) => timelineEvent.gameId === selectedTimelineGameId.value)
    .filter((timelineEvent) =>
      [
        timelineEvent.name,
        timelineEvent.description,
        timelineEvent.game?.title,
        ...(timelineEvent.characters || []).map((character) => character.name),
        ...(timelineEvent.factions || []).map((faction) => faction.name),
        ...(timelineEvent.intrigues || []).map((intrigue) => intrigue.name),
        ...(timelineEvent.items || []).map((item) => item.name)
      ].some((field) => field?.toLowerCase().includes(term))
    )
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.name.localeCompare(b.name))
})

const fetchTimelineEvents = async () => {
  timelineEvents.value = await fetchOfflineList('timelineEvents', '/api/timeline-events')
}

const fetchGames = async () => {
  games.value = await fetchOfflineList('games', '/api/games')
}

const fetchCharacters = async () => {
  characters.value = await fetchOfflineList('characters', '/api/characters')
}

const fetchIntrigues = async () => {
  intrigues.value = await fetchOfflineList('intrigues', '/api/intrigues')
}

const fetchFactions = async () => {
  factions.value = await fetchOfflineList('factions', '/api/factions')
}

const fetchItems = async () => {
  items.value = await fetchOfflineList('items', '/api/items')
}

const refreshData = async () => {
  await Promise.all([fetchTimelineEvents(), fetchGames(), fetchCharacters(), fetchFactions(), fetchIntrigues(), fetchItems()])
}

const { isOffline } = useConnectionRefresh(refreshData)

onMounted(async () => {
  await refreshData()
  restoreTimelineGameContext()
})

function eventFormPayload(timelineEvent: TimelineEventRow): TimelineEventDraft {
  return {
    ...timelineEvent,
    characterIds: timelineEvent.characters?.map((character) => character.id) || [],
    factionIds: timelineEvent.factions?.map((faction) => faction.id) || [],
    intrigueIds: timelineEvent.intrigues?.map((intrigue) => intrigue.id) || [],
    itemIds: timelineEvent.items?.map((item) => item.id) || []
  }
}

function startCreate() {
  if (isOffline.value || !selectedTimelineGameId.value) return

  activeFormEvent.value = {
    name: '',
    description: '',
    day: 1,
    time: '12:00',
    requiredResponsibles: 0,
    gameId: selectedTimelineGameId.value,
    characterIds: [],
    factionIds: [],
    intrigueIds: [],
    itemIds: []
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(timelineEvent: TimelineEventRow) {
  activeFormEvent.value = eventFormPayload(timelineEvent)
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormEvent.value = null
  showFormSlideover.value = false
}

function openEventPage(timelineEvent: TimelineEventRow) {
  if (!timelineEvent?.id) return
  if (selectedTimelineGameId.value) {
    rememberTimelineGame(selectedTimelineGameId.value)
    rememberTimelineReturnContext({ source: 'timeline', gameId: selectedTimelineGameId.value, eventId: timelineEvent.id })
  }
  router.push(`/timeline/${timelineEvent.slug}`)
}

async function handleEventFormSubmit() {
  if (!activeFormEvent.value) return
  if (formMode.value === 'create') {
    await useApiFetch('/api/timeline-events', {
      method: 'POST',
      body: activeFormEvent.value
    })
  } else {
    await useApiFetch(`/api/timeline-events/${activeFormEvent.value.id}`, {
      method: 'PUT',
      body: activeFormEvent.value
    })
  }

  closeFormSlideover()
  await fetchTimelineEvents()
}

async function deleteTimelineEvent(id: string) {
  if (await confirmedDelete(`/api/timeline-events/${id}`, DELETE_CONFIRMATIONS.timelineEvent)) await fetchTimelineEvents()
}

watch(() => [route.query.gameId, route.query.game], () => {
  restoreTimelineGameContext()
})

function rememberTimelineGame(gameId: string) {
  if (!import.meta.client || !gameId) return
  sessionStorage.setItem('limbus:timeline-game-id', gameId)
}

function rememberTimelineReturnContext(context: ReturnContext) {
  if (!import.meta.client) return
  sessionStorage.setItem('limbus:timeline-return-context', JSON.stringify(context))
}

function restoreTimelineGameContext() {
  if (selectedGame.value) return

  const routeGame = route.query.game || route.query.gameId
  const storedGameId = import.meta.client ? sessionStorage.getItem('limbus:timeline-game-id') : ''
  const gameKey = typeof routeGame === 'string' && routeGame ? routeGame : storedGameId
  if (!gameKey) return

  const game = games.value.find((item) => item.id === gameKey || item.slug === gameKey)
  if (!game) return
  if (gameFilter.value === game.id) return

  gameFilter.value = game.id
  gameSearch.value = game.title
  rememberTimelineGame(game.id)

  if (typeof routeGame === 'string' && routeGame) {
    router.replace({ path: route.path, query: {} })
  }
}
</script>
