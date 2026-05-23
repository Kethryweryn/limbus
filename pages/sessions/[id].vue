<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <UButton to="/sessions" color="neutral" variant="ghost" icon="i-heroicons-arrow-left" class="mb-3">
          Sessions
        </UButton>
        <h1 class="text-2xl font-bold">{{ session?.name || 'Session' }}</h1>
        <p class="text-sm text-gray-500">
          {{ session?.game?.title || 'Jeu inconnu' }}
          <span v-if="session?.date"> · {{ formatDate(session.date) }}</span>
          <span v-if="session?.location"> · {{ session.location.name }}</span>
        </p>
      </div>
      <div v-if="session" class="flex flex-wrap items-center gap-2">
        <UBadge :color="statusMeta(session.status).color" variant="subtle">
          {{ statusMeta(session.status).label }}
        </UBadge>
        <UButton
          v-if="!isEditingDetails"
          icon="i-heroicons-pencil-square"
          color="primary"
          @click="startEditDetails"
        >
          Modifier
        </UButton>
      </div>
    </div>

    <SessionForm
      v-if="session && isEditingDetails"
      v-model:session="editableSession"
      :games="games"
      :characters="characters"
      :locations="locations"
      :participants="participants"
      mode="edit"
      :show-cast="false"
      @submit="saveDetails"
      @cancel="cancelEditDetails"
    />

    <SessionCastForm
      v-else-if="session"
      :session="session"
      :characters="characters"
      :participants="participants"
      :on-save="saveCast"
    />

    <UCard v-else>
      Chargement...
    </UCard>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import SessionCastForm from '@/components/SessionCastForm.vue'
import SessionForm from '@/components/SessionForm.vue'

const route = useRoute()
const router = useRouter()
const session = ref(null)
const games = ref([])
const characters = ref([])
const locations = ref([])
const participants = ref([])
const isEditingDetails = ref(route.query.edit === 'details')
const editableSession = ref(null)

const statusLabels = {
  scheduled: { label: 'Prévue', color: 'primary' },
  postponed: { label: 'Reportée', color: 'warning' },
  cancelled: { label: 'Annulée', color: 'error' },
  completed: { label: 'Terminée', color: 'success' }
}

const statusMeta = (status) => statusLabels[status] || statusLabels.scheduled

const formatDate = (value) => new Date(value).toLocaleString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

async function loadData() {
  const [sessionData, gamesData, charactersData, locationsData, participantsData] = await Promise.all([
    useApiFetch(`/api/sessions/${route.params.id}`),
    useApiFetch('/api/games'),
    useApiFetch('/api/characters'),
    useApiFetch('/api/locations'),
    useApiFetch('/api/participants')
  ])

  session.value = sessionData
  games.value = gamesData
  characters.value = charactersData
  locations.value = locationsData
  participants.value = participantsData
  editableSession.value = normalizeSessionForForm(sessionData)
}

async function saveCast(assignments) {
  if (!session.value) return

  session.value = await useApiFetch(`/api/sessions/${session.value.id}`, {
    method: 'PUT',
    body: {
      name: session.value.name,
      gameId: session.value.gameId,
      date: toDatetimeLocal(session.value.date),
      locationId: session.value.locationId || '',
      status: session.value.status || 'scheduled',
      published: session.value.published,
      participants: session.value.participants?.map((participant) => ({
        participantId: participant.participantId || participant.participant?.id,
        role: participant.role
      })) || [],
      assignments
    }
  })
}

function toDatetimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function normalizeSessionForForm(value) {
  return {
    ...value,
    date: toDatetimeLocal(value.date),
    locationId: value.locationId || '',
    organizerIds: value.participants
      ?.filter((participant) => participant.role === 'organizer')
      .map((participant) => participant.participantId || participant.participant?.id)
      .filter(Boolean) || [],
    npcIds: value.participants
      ?.filter((participant) => participant.role === 'npc')
      .map((participant) => participant.participantId || participant.participant?.id)
      .filter(Boolean) || [],
    assignments: value.assignments?.map((assignment) => ({
      characterId: assignment.characterId,
      participantId: assignment.participantId || '',
      photoUrl: assignment.photoUrl || '',
      notes: assignment.notes || ''
    })) || []
  }
}

watch(() => route.query.edit, (value) => {
  isEditingDetails.value = value === 'details'
  if (isEditingDetails.value && session.value) {
    editableSession.value = normalizeSessionForForm(session.value)
  }
})

function startEditDetails() {
  if (!session.value) return

  editableSession.value = normalizeSessionForForm(session.value)
  isEditingDetails.value = true
  router.replace({ path: route.path, query: { ...route.query, edit: 'details' } })
}

function cancelEditDetails() {
  isEditingDetails.value = false
  editableSession.value = session.value ? normalizeSessionForForm(session.value) : null
  const query = { ...route.query }
  delete query.edit
  router.replace({ path: route.path, query })
}

async function saveDetails() {
  if (!editableSession.value?.id) return

  session.value = await useApiFetch(`/api/sessions/${editableSession.value.id}`, {
    method: 'PUT',
    body: editableSession.value
  })
  editableSession.value = normalizeSessionForForm(session.value)
  cancelEditDetails()
}

onMounted(loadData)
</script>
