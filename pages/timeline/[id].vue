<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <UButton to="/timeline" color="neutral" variant="ghost" icon="i-heroicons-arrow-left" class="mb-3">
          Timeline
        </UButton>
        <p class="text-sm text-gray-500">Jour {{ timelineEvent?.day }} · {{ timelineEvent?.time }}</p>
        <h1 class="text-2xl font-bold">{{ timelineEvent?.name || 'Événement' }}</h1>
        <p class="text-sm text-gray-500">{{ timelineEvent?.game?.title || 'Jeu inconnu' }}</p>
      </div>
      <UButton
        v-if="timelineEvent && !isEditing"
        icon="i-heroicons-pencil-square"
        color="primary"
        @click="startEdit"
      >
        Modifier
      </UButton>
    </div>

    <TimelineEventForm
      v-if="timelineEvent && isEditing"
      v-model:event="editableEvent"
      :games="games"
      :characters="characters"
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

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h2 class="text-sm font-semibold mb-2">Personnages</h2>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="character in timelineEvent.characters || []" :key="character.id" color="neutral" variant="subtle">
                  {{ character.name }}
                </UBadge>
                <span v-if="!timelineEvent.characters?.length" class="text-sm text-gray-500">Aucun</span>
              </div>
            </div>
            <div>
              <h2 class="text-sm font-semibold mb-2">Intrigues</h2>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="intrigue in timelineEvent.intrigues || []" :key="intrigue.id" color="primary" variant="subtle">
                  {{ intrigue.name }}
                </UBadge>
                <span v-if="!timelineEvent.intrigues?.length" class="text-sm text-gray-500">Aucune</span>
              </div>
            </div>
            <div>
              <h2 class="text-sm font-semibold mb-2">Objets</h2>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="item in timelineEvent.items || []" :key="item.id" color="success" variant="subtle">
                  {{ item.name }}
                </UBadge>
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

    <UCard v-else>
      Chargement...
    </UCard>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import TimelineEventForm from '@/components/TimelineEventForm.vue'

const route = useRoute()
const router = useRouter()
const timelineEvent = ref(null)
const editableEvent = ref(null)
const games = ref([])
const characters = ref([])
const intrigues = ref([])
const items = ref([])
const isEditing = ref(route.query.edit === '1')

async function loadData() {
  const [eventData, gamesData, charactersData, intriguesData, itemsData] = await Promise.all([
    useApiFetch(`/api/timeline-events/${route.params.id}`),
    useApiFetch('/api/games'),
    useApiFetch('/api/characters'),
    useApiFetch('/api/intrigues'),
    useApiFetch('/api/items')
  ])

  timelineEvent.value = eventData
  games.value = gamesData
  characters.value = charactersData
  intrigues.value = intriguesData
  items.value = itemsData
  editableEvent.value = eventFormPayload(eventData)
}

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && timelineEvent.value) {
    editableEvent.value = eventFormPayload(timelineEvent.value)
  }
})

function eventFormPayload(value) {
  return {
    ...value,
    characterIds: value.characterIds || value.characters?.map((character) => character.id) || [],
    intrigueIds: value.intrigueIds || value.intrigues?.map((intrigue) => intrigue.id) || [],
    itemIds: value.itemIds || value.items?.map((item) => item.id) || []
  }
}

function startEdit() {
  if (!timelineEvent.value) return

  editableEvent.value = eventFormPayload(timelineEvent.value)
  isEditing.value = true
  router.replace({ path: route.path, query: { edit: '1' } })
}

function cancelEdit() {
  isEditing.value = false
  editableEvent.value = timelineEvent.value ? eventFormPayload(timelineEvent.value) : null
  router.replace({ path: route.path })
}

async function saveEvent() {
  if (!editableEvent.value?.id) return

  timelineEvent.value = await useApiFetch(`/api/timeline-events/${editableEvent.value.id}`, {
    method: 'PUT',
    body: editableEvent.value
  })
  editableEvent.value = eventFormPayload(timelineEvent.value)
  cancelEdit()
}

function conflictTitle(value) {
  const labels = value.conflicts
    .map((conflict) => `${conflict.type === 'character' ? 'Personnage' : 'Objet'} : ${conflict.name}`)
    .join(', ')
  return `Conflit au même créneau (${labels})`
}

onMounted(loadData)
</script>
