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

    <div v-if="session && !isEditingDetails" class="flex flex-wrap gap-2">
      <UButton
        :color="activeTab === 'cast' ? 'primary' : 'neutral'"
        :variant="activeTab === 'cast' ? 'solid' : 'soft'"
        @click="setTab('cast')"
      >
        Cast
      </UButton>
      <UButton
        :color="activeTab === 'timeline' ? 'primary' : 'neutral'"
        :variant="activeTab === 'timeline' ? 'solid' : 'soft'"
        @click="setTab('timeline')"
      >
        Timeline
      </UButton>
      <UButton
        :color="activeTab === 'documents' ? 'primary' : 'neutral'"
        :variant="activeTab === 'documents' ? 'solid' : 'soft'"
        @click="setTab('documents')"
      >
        Documents
      </UButton>
    </div>

    <SessionCastForm
      v-if="session && !isEditingDetails && activeTab === 'cast'"
      :session="session"
      :characters="characters"
      :participants="participants"
      :on-save="saveCast"
    />

    <SessionTimelineForm
      v-if="session && !isEditingDetails && activeTab === 'timeline' && timelineData"
      :timeline-data="timelineData"
      :on-save="saveTimeline"
    />

    <SessionDocumentsManager
      v-if="session && !isEditingDetails && activeTab === 'documents' && documentsData"
      :documents-data="documentsData"
      :on-refresh="refreshDocumentsData"
    />

    <UCard v-if="!session">
      Chargement...
    </UCard>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import SessionCastForm from '@/components/SessionCastForm.vue'
import SessionForm from '@/components/SessionForm.vue'
import SessionTimelineForm from '@/components/SessionTimelineForm.vue'
import SessionDocumentsManager from '@/components/SessionDocumentsManager.vue'
import { SESSION_ROLES, SESSION_STATUSES, SESSION_STATUS_META } from '~/utils/domain'

const route = useRoute()
const router = useRouter()
const session = ref(null)
const games = ref([])
const characters = ref([])
const locations = ref([])
const participants = ref([])
const timelineData = ref(null)
const documentsData = ref(null)
const activeTab = ref(['timeline', 'documents'].includes(route.query.tab) ? route.query.tab : 'cast')
const isEditingDetails = ref(route.query.edit === 'details')
const editableSession = ref(null)

const statusMeta = (status) => SESSION_STATUS_META[status] || SESSION_STATUS_META[SESSION_STATUSES.scheduled]

const formatDate = (value) => new Date(value).toLocaleString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

async function loadData() {
  const [sessionData, gamesData, charactersData, locationsData, participantsData, timelineSessionData, sessionDocumentsData] = await Promise.all([
    useApiFetch(`/api/sessions/${route.params.id}`),
    useApiFetch('/api/games'),
    useApiFetch('/api/characters'),
    useApiFetch('/api/locations'),
    useApiFetch('/api/participants'),
    useApiFetch(`/api/sessions/${route.params.id}/timeline`),
    useApiFetch(`/api/sessions/${route.params.id}/documents`)
  ])

  session.value = sessionData
  games.value = gamesData
  characters.value = charactersData
  locations.value = locationsData
  participants.value = participantsData
  timelineData.value = timelineSessionData
  documentsData.value = sessionDocumentsData
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
      status: session.value.status || SESSION_STATUSES.scheduled,
      published: session.value.published,
      participants: session.value.participants?.map((participant) => ({
        participantId: participant.participantId || participant.participant?.id,
        role: participant.role
      })) || [],
      assignments
    }
  })
}

async function saveTimeline(assignments) {
  if (!session.value) return

  await useApiFetch(`/api/sessions/${session.value.id}/timeline`, {
    method: 'PUT',
    body: { assignments }
  })
  timelineData.value = await useApiFetch(`/api/sessions/${session.value.id}/timeline`)
}

async function refreshDocumentsData() {
  if (!session.value) return
  documentsData.value = await useApiFetch(`/api/sessions/${session.value.id}/documents`)
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
      ?.filter((participant) => participant.role === SESSION_ROLES.organizer)
      .map((participant) => participant.participantId || participant.participant?.id)
      .filter(Boolean) || [],
    npcIds: value.participants
      ?.filter((participant) => participant.role === SESSION_ROLES.npc)
      .map((participant) => participant.participantId || participant.participant?.id)
      .filter(Boolean) || [],
    kitchenIds: value.participants
      ?.filter((participant) => participant.role === SESSION_ROLES.kitchen)
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

watch(() => route.query.tab, (value) => {
  activeTab.value = ['timeline', 'documents'].includes(value) ? value : 'cast'
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

function setTab(tab) {
  activeTab.value = tab
  router.replace({ path: route.path, query: { ...route.query, tab } })
}

async function saveDetails() {
  if (!editableSession.value?.id) return

  session.value = await useApiFetch(`/api/sessions/${editableSession.value.id}`, {
    method: 'PUT',
    body: editableSession.value
  })
  editableSession.value = normalizeSessionForForm(session.value)
  timelineData.value = await useApiFetch(`/api/sessions/${session.value.id}/timeline`)
  await refreshDocumentsData()
  cancelEditDetails()
}

onMounted(loadData)
</script>
