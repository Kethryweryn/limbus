<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Timeline</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton v-if="!isOffline" icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer un événement
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un événement..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
    </div>

    <div v-if="filteredEvents.length" class="space-y-8">
      <UCard>
        <template #header>
          <div>
            <h2 class="font-semibold">Vue chronologique</h2>
            <p class="text-sm text-gray-500">Timeline abstraite du jeu, organisée par jour et par horaire.</p>
          </div>
        </template>

        <div class="overflow-x-auto">
          <div
            class="min-w-[52rem] grid rounded border border-gray-200 bg-white text-sm"
            :style="{ gridTemplateColumns: `7rem repeat(${timelineDays.length}, minmax(14rem, 1fr))` }"
          >
            <div class="sticky left-0 z-20 border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium">
              Horaire
            </div>
            <div
              v-for="day in timelineDays"
              :key="`header-${day}`"
              class="border-r border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium"
            >
              Jour {{ day }}
            </div>

            <template v-for="time in timelineTimes" :key="time">
              <div class="sticky left-0 z-10 border-r border-b border-gray-200 bg-white px-3 py-3 font-medium">
                {{ time }}
              </div>
              <div
                v-for="day in timelineDays"
                :key="`${day}-${time}`"
                class="min-h-28 border-r border-b border-gray-200 p-2"
              >
                <button
                  v-for="timelineEvent in eventsForSlot(day, time)"
                  :key="timelineEvent.id"
                  type="button"
                  class="mb-2 w-full rounded border border-gray-200 bg-gray-50 p-3 text-left transition hover:border-primary-300 hover:bg-primary-50"
                  @click="openEventPage(timelineEvent)"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="font-medium leading-tight">{{ timelineEvent.name }}</span>
                    <UIcon
                      v-if="timelineEvent.conflicts?.length"
                      name="i-heroicons-exclamation-triangle"
                      class="size-4 shrink-0 text-warning-500"
                    />
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1">
                    <UBadge v-if="timelineEvent.requiredResponsibles" color="neutral" variant="subtle" size="xs">
                      {{ timelineEvent.requiredResponsibles }} resp.
                    </UBadge>
                    <UBadge v-if="timelineEvent.characters?.length" color="neutral" variant="subtle" size="xs">
                      {{ timelineEvent.characters.length }} perso.
                    </UBadge>
                    <UBadge v-if="timelineEvent.items?.length" color="success" variant="subtle" size="xs">
                      {{ timelineEvent.items.length }} objet(s)
                    </UBadge>
                  </div>
                </button>
              </div>
            </template>
          </div>
        </div>
      </UCard>

      <div>
        <h2 class="text-lg font-semibold mb-3">Détail des événements</h2>
      <section
        v-for="dayGroup in eventsByDay"
        :key="dayGroup.day"
        class="rounded-lg border border-gray-200 bg-white"
      >
        <div class="border-b border-gray-100 px-4 py-3">
          <h2 class="font-semibold">Jour {{ dayGroup.day }}</h2>
        </div>

        <div class="divide-y divide-gray-100">
          <article
            v-for="timelineEvent in dayGroup.events"
            :key="timelineEvent.id"
            class="grid cursor-pointer grid-cols-1 lg:grid-cols-[7rem_1fr_auto] gap-4 p-4 hover:bg-gray-50"
            role="link"
            tabindex="0"
            @click="openEventPage(timelineEvent)"
            @keydown.enter="openEventPage(timelineEvent)"
          >
            <div class="flex lg:block items-center gap-2">
              <UBadge color="neutral" variant="subtle">{{ timelineEvent.time }}</UBadge>
              <UBadge
                v-if="timelineEvent.conflicts?.length"
                color="warning"
                variant="soft"
                size="xs"
              >
                Conflit
              </UBadge>
            </div>

            <div class="min-w-0 space-y-3">
              <div>
                <h3 class="text-lg font-semibold leading-tight">{{ timelineEvent.name }}</h3>
                <p class="text-sm text-gray-500">{{ timelineEvent.game?.title || 'Jeu inconnu' }}</p>
              </div>

              <p class="text-sm leading-6 text-gray-600 line-clamp-3">
                {{ timelineEvent.description || 'Aucune description renseignée.' }}
              </p>

              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="character in timelineEvent.characters || []"
                  :key="`character-${character.id}`"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  class="max-w-44 truncate"
                >
                  {{ character.name }}
                </UBadge>
                <UBadge
                  v-for="intrigue in timelineEvent.intrigues || []"
                  :key="`intrigue-${intrigue.id}`"
                  color="primary"
                  variant="subtle"
                  size="xs"
                  class="max-w-44 truncate"
                >
                  {{ intrigue.name }}
                </UBadge>
                <UBadge
                  v-for="item in timelineEvent.items || []"
                  :key="`item-${item.id}`"
                  color="success"
                  variant="subtle"
                  size="xs"
                  class="max-w-44 truncate"
                >
                  {{ item.name }}
                </UBadge>
              </div>

              <UAlert
                v-if="timelineEvent.conflicts?.length"
                color="warning"
                variant="soft"
                icon="i-heroicons-exclamation-triangle"
                :title="conflictTitle(timelineEvent)"
              />
            </div>

            <div class="flex lg:flex-col gap-2 lg:items-end">
              <UBadge color="neutral" variant="outline" class="whitespace-nowrap">
                {{ timelineEvent.requiredResponsibles || 0 }} responsable(s)
              </UBadge>
              <UButton
                v-if="!isOffline"
                icon="i-heroicons-pencil-square"
                size="xs"
                color="primary"
                @click.stop="startEdit(timelineEvent)"
              >
                Modifier
              </UButton>
              <UButton
                v-if="!isOffline"
                icon="i-heroicons-trash"
                size="xs"
                color="error"
                variant="soft"
                @click.stop="deleteTimelineEvent(timelineEvent.id)"
              >
                Supprimer
              </UButton>
            </div>
          </article>
        </div>
      </section>
      </div>
    </div>

    <UCard v-else>
      Aucun événement de timeline.
    </UCard>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier l’événement' : 'Créer un événement'"
      :full-page-to="formMode === 'edit' && activeFormEvent?.id ? `/timeline/${activeFormEvent.id}?edit=1` : null"
      @close="closeFormSlideover"
      @full-page="showFormSlideover = false"
    >
      <TimelineEventForm
        v-if="activeFormEvent"
        v-model:event="activeFormEvent"
        :games="games"
        :characters="characters"
        :intrigues="intrigues"
        :items="items"
        :mode="formMode"
        @submit="handleEventFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import GameContextBar from '@/components/GameContextBar.vue'
import TimelineEventForm from '@/components/TimelineEventForm.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const timelineEvents = ref([])
const games = ref([])
const characters = ref([])
const intrigues = ref([])
const items = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormEvent = ref(null)
const formMode = ref('create')
const router = useRouter()
const { game: selectedGame } = useGameFocus()

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const filteredEvents = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  return timelineEvents.value
    .filter((timelineEvent) => !gameId || timelineEvent.gameId === gameId)
    .filter((timelineEvent) =>
      [
        timelineEvent.name,
        timelineEvent.description,
        timelineEvent.game?.title,
        ...(timelineEvent.characters || []).map((character) => character.name),
        ...(timelineEvent.intrigues || []).map((intrigue) => intrigue.name),
        ...(timelineEvent.items || []).map((item) => item.name)
      ].some((field) => field?.toLowerCase().includes(term))
    )
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.name.localeCompare(b.name))
})

const eventsByDay = computed(() => {
  const groups = new Map()
  for (const timelineEvent of filteredEvents.value) {
    const current = groups.get(timelineEvent.day) || []
    current.push(timelineEvent)
    groups.set(timelineEvent.day, current)
  }

  return [...groups.entries()].map(([day, events]) => ({ day, events }))
})

const timelineDays = computed(() => [...new Set(filteredEvents.value.map((timelineEvent) => timelineEvent.day))].sort((a, b) => a - b))

const timelineTimes = computed(() => [...new Set(filteredEvents.value.map((timelineEvent) => timelineEvent.time))].sort((a, b) => a.localeCompare(b)))

function eventsForSlot(day, time) {
  return filteredEvents.value.filter((timelineEvent) => timelineEvent.day === day && timelineEvent.time === time)
}

const fetchTimelineEvents = async () => {
  if (isOfflineMode()) {
    timelineEvents.value = await getFromStore('timelineEvents', 'list') || []
    return
  }

  const data = await useApiFetch('/api/timeline-events')
  timelineEvents.value = data
  await saveToStore('timelineEvents', 'list', data)
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

const fetchIntrigues = async () => {
  if (isOfflineMode()) {
    intrigues.value = await getFromStore('intrigues', 'list') || []
    return
  }

  const data = await useApiFetch('/api/intrigues')
  intrigues.value = data
  await saveToStore('intrigues', 'list', data)
}

const fetchItems = async () => {
  if (isOfflineMode()) {
    items.value = await getFromStore('items', 'list') || []
    return
  }

  const data = await useApiFetch('/api/items')
  items.value = data
  await saveToStore('items', 'list', data)
}

const refreshData = async () => {
  await Promise.all([fetchTimelineEvents(), fetchGames(), fetchCharacters(), fetchIntrigues(), fetchItems()])
}

const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = isOfflineMode()

  if (isOffline.value) {
    closeFormSlideover()
  }

  if (wasOffline !== isOffline.value) {
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

function eventFormPayload(timelineEvent) {
  return {
    ...timelineEvent,
    characterIds: timelineEvent.characterIds || timelineEvent.characters?.map((character) => character.id) || [],
    intrigueIds: timelineEvent.intrigueIds || timelineEvent.intrigues?.map((intrigue) => intrigue.id) || [],
    itemIds: timelineEvent.itemIds || timelineEvent.items?.map((item) => item.id) || []
  }
}

function startCreate() {
  if (isOffline.value) return

  activeFormEvent.value = {
    name: '',
    description: '',
    day: 1,
    time: '12:00',
    requiredResponsibles: 0,
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    characterIds: [],
    intrigueIds: [],
    itemIds: [],
    published: true
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(timelineEvent) {
  if (isOffline.value) return

  activeFormEvent.value = eventFormPayload(timelineEvent)
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormEvent.value = null
  showFormSlideover.value = false
}

function openEventPage(timelineEvent) {
  if (!timelineEvent?.id) return
  router.push(`/timeline/${timelineEvent.id}`)
}

async function handleEventFormSubmit() {
  if (isOffline.value) return

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

async function deleteTimelineEvent(id) {
  if (isOffline.value) return
  if (!confirm('Supprimer cet événement ?')) return

  await useApiFetch(`/api/timeline-events/${id}`, { method: 'DELETE' })
  await fetchTimelineEvents()
}

function conflictTitle(timelineEvent) {
  const labels = timelineEvent.conflicts
    .map((conflict) => `${conflict.type === 'character' ? 'Personnage' : 'Objet'} : ${conflict.name}`)
    .join(', ')
  return `Conflit au même créneau (${labels})`
}
</script>
