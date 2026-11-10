<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <UButton :to="timelineBackTo" color="neutral" variant="ghost" icon="i-heroicons-arrow-left" class="mb-3">
          Timeline
        </UButton>
        <p class="text-sm text-gray-500">Jour {{ timelineEvent?.day }} · {{ timelineEvent?.time }}</p>
        <h1 class="text-2xl font-bold">{{ timelineEvent?.name || 'Événement' }}</h1>
        <p class="text-sm text-gray-500">{{ timelineEvent?.game?.title || 'Jeu inconnu' }}</p>
      </div>
      <div v-if="timelineEvent" class="flex flex-wrap items-start gap-2">
        <UButton
          v-if="!isEditing"
          icon="i-heroicons-pencil-square"
          color="primary"
          @click="startEdit"
        >
          Modifier
        </UButton>
        <SheetDeleteButton :url="`/api/timeline-events/${timelineEvent.id}`" :confirm-text="DELETE_CONFIRMATIONS.timelineEvent" :list-path="timelineBackTo" />
      </div>
    </div>

    <TimelineEventForm
      v-if="timelineEvent && isEditing && editableEvent"
      v-model:event="editableEvent"
      :games="games"
      :characters="characters"
      :factions="factions"
      :intrigues="intrigues"
      :items="items"
      mode="edit"
      @submit="saveEvent"
      @cancel="cancelEdit"
    />

    <div v-else-if="timelineEvent" class="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-6">
      <UCard>
        <div class="space-y-6">
          <p class="text-sm leading-6 text-gray-700 whitespace-pre-line">
            {{ timelineEvent.description || 'Aucune description renseignée.' }}
          </p>

          <UAlert
            v-if="timelineEvent.conflicts?.length"
            color="warning"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            :title="conflictTitle(timelineEvent)"
          />

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <h2 class="text-sm font-semibold mb-2">Personnages</h2>
              <div class="flex flex-wrap gap-1">
                <NuxtLink
                  v-for="character in timelineEvent.characters || []"
                  :key="character.id"
                  :to="`/characters/${character.slug}`"
                >
                  <UBadge color="neutral" variant="subtle" class="cursor-pointer hover:ring-1 hover:ring-neutral-300">
                    {{ character.name }}
                  </UBadge>
                </NuxtLink>
                <span v-if="!timelineEvent.characters?.length" class="text-sm text-gray-500">Aucun</span>
              </div>
            </div>
            <div>
              <h2 class="text-sm font-semibold mb-2">Groupes</h2>
              <div class="flex flex-wrap gap-1">
                <NuxtLink
                  v-for="faction in timelineEvent.factions || []"
                  :key="faction.id"
                  :to="`/factions/${faction.slug}`"
                >
                  <UBadge color="warning" variant="subtle" class="cursor-pointer hover:ring-1 hover:ring-warning-300">
                    {{ faction.name }}
                  </UBadge>
                </NuxtLink>
                <span v-if="!timelineEvent.factions?.length" class="text-sm text-gray-500">Aucun</span>
              </div>
            </div>
            <div>
              <h2 class="text-sm font-semibold mb-2">Intrigues</h2>
              <div class="flex flex-wrap gap-1">
                <NuxtLink
                  v-for="intrigue in timelineEvent.intrigues || []"
                  :key="intrigue.id"
                  :to="`/intrigues/${intrigue.slug}`"
                >
                  <UBadge color="primary" variant="subtle" class="cursor-pointer hover:ring-1 hover:ring-primary-300">
                    {{ intrigue.name }}
                  </UBadge>
                </NuxtLink>
                <span v-if="!timelineEvent.intrigues?.length" class="text-sm text-gray-500">Aucune</span>
              </div>
            </div>
            <div>
              <h2 class="text-sm font-semibold mb-2">Objets</h2>
              <div class="flex flex-wrap gap-1">
                <NuxtLink
                  v-for="item in timelineEvent.items || []"
                  :key="item.id"
                  :to="`/items/${item.slug}`"
                >
                  <UBadge color="success" variant="subtle" class="cursor-pointer hover:ring-1 hover:ring-success-300">
                    {{ item.name }}
                  </UBadge>
                </NuxtLink>
                <span v-if="!timelineEvent.items?.length" class="text-sm text-gray-500">Aucun</span>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          Logistique
        </template>
        <dl class="space-y-4 text-sm">
          <div>
            <dt class="text-gray-500">Créneau</dt>
            <dd class="font-medium">Jour {{ timelineEvent.day }} · {{ timelineEvent.time }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Responsables nécessaires</dt>
            <dd class="font-medium">{{ timelineEvent.requiredResponsibles || 0 }}</dd>
          </div>
        </dl>
      </UCard>
    </div>

    <UAlert v-else-if="loadError" color="error" variant="soft" :description="loadError" />
    <UCard v-else>
      Chargement...
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { DELETE_CONFIRMATIONS } from '~/utils/deleteConfirmations'
import { computed, onMounted, ref } from 'vue'
import { loadErrorMessage } from '~/utils/apiErrors'
import TimelineEventForm from '@/components/TimelineEventForm.vue'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { TimelineEventDraft } from '~/utils/writingDrafts'
import { conflictTitle } from '~/utils/timeline'
import { sheetReads } from '~/utils/offlinePlan'

type TimelineEventDetail = ApiResponse<'/api/timeline-events/:id'>
// D'où l'on vient : la timeline d'un jeu ou l'onglet Timeline d'une session
type ReturnContext = { source: string, eventId: string, gameId?: string, sessionId?: string, sessionSlug?: string }

const route = useRoute()
const timelineEvent = ref<TimelineEventDetail | null>(null)
const games = ref<ApiResponse<'/api/games'>>([])
const characters = ref<ApiResponse<'/api/characters'>>([])
const factions = ref<ApiResponse<'/api/factions'>>([])
const intrigues = ref<ApiResponse<'/api/intrigues'>>([])
const items = ref<ApiResponse<'/api/items'>>([])
const { isEditing, draft: editableEvent, startEdit, cancelEdit, closeAfterSave, closeAfterQueued } = useSheetEdit(() => timelineEvent.value ? eventFormPayload(timelineEvent.value) : null)
const returnContext = ref<ReturnContext | null>(null)
const timelineBackTo = computed(() => ({
  path: returnContext.value?.source === 'session'
    // Retour à la session par son slug (la page des sessions ne s'ouvre pas par identifiant), sinon à la liste
    ? (returnContext.value.sessionSlug ? `/sessions/${returnContext.value.sessionSlug}` : '/sessions')
    : '/timeline',
  query: returnContext.value?.source === 'session'
    ? { tab: 'timeline' }
    : {}
}))

async function loadData() {
  const [eventData, gamesData, charactersData, factionsData, intriguesData, itemsData] = await Promise.all([
    useApiFetch(sheetReads.timelineEvent(String(route.params.slug)), { offlineCache: true }),
    useApiFetch('/api/games', { offlineCache: true }),
    useApiFetch('/api/characters', { offlineCache: true }),
    useApiFetch('/api/factions', { offlineCache: true }),
    useApiFetch('/api/intrigues', { offlineCache: true }),
    useApiFetch('/api/items', { offlineCache: true })
  ])

  timelineEvent.value = eventData
  ensureTimelineReturnContext(eventData)
  games.value = gamesData
  characters.value = charactersData
  factions.value = factionsData
  intrigues.value = intriguesData
  items.value = itemsData
  editableEvent.value = eventFormPayload(eventData)
}

function readTimelineReturnContext(): ReturnContext | null {
  if (!import.meta.client) return null

  try {
    const raw = sessionStorage.getItem('limbus:timeline-return-context')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function ensureTimelineReturnContext(eventData: TimelineEventDetail) {
  const storedContext = readTimelineReturnContext()
  returnContext.value = storedContext?.eventId === eventData?.id ? storedContext : null
  if (returnContext.value || !import.meta.client || !eventData?.gameId) return

  const fallbackContext = { source: 'timeline', gameId: eventData.gameId, eventId: eventData.id }
  returnContext.value = fallbackContext
  sessionStorage.setItem('limbus:timeline-game-id', eventData.gameId)
  sessionStorage.setItem('limbus:timeline-return-context', JSON.stringify(fallbackContext))
}

function eventFormPayload(value: TimelineEventDetail): TimelineEventDraft {
  return {
    ...value,
    characterIds: value.characters?.map((character) => character.id) || [],
    factionIds: value.factions?.map((faction) => faction.id) || [],
    intrigueIds: value.intrigues?.map((intrigue) => intrigue.id) || [],
    itemIds: value.items?.map((item) => item.id) || []
  }
}

async function saveEvent() {
  if (!editableEvent.value?.id) return

  const updated = await useApiFetch(`/api/timeline-events/${editableEvent.value.id}`, {
    method: 'PUT',
    body: editableEvent.value
  })
  if (isOfflineQueued(updated)) return closeAfterQueued(timelineEvent)
  // La réponse de l'enregistrement n'a pas les conflits du créneau : on relit l'événement, sans faire échouer
  // l'enregistrement si la relecture échoue (les conflits lus avant restent alors affichés)
  const reloaded = await useApiFetch(`/api/timeline-events/${updated.id}`)
    .catch(() => ({ ...updated, conflicts: timelineEvent.value?.conflicts || [] }))
  timelineEvent.value = reloaded
  await closeAfterSave(`/timeline/${updated.slug}`)
}

// Fiche absente (lien ancien, slug changé) ou refusée : un message plutôt qu'un chargement sans fin
const loadError = ref('')
onMounted(async () => {
  try {
    await loadData()
  } catch (err) {
    loadError.value = loadErrorMessage(err, 'Événement introuvable.')
  }
})
</script>
