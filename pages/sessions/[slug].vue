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
        <p v-if="session?.postponedTo" class="text-sm">
          Reportée sur
          <NuxtLink :to="`/sessions/${session.postponedTo.slug}`" class="font-medium underline">{{ session.postponedTo.name }}</NuxtLink>
        </p>
        <p v-if="session?.postponedFrom" class="text-sm">
          Report de
          <NuxtLink :to="`/sessions/${session.postponedFrom.slug}`" class="font-medium underline">{{ session.postponedFrom.name }}</NuxtLink>
        </p>
      </div>
      <div v-if="session" class="flex flex-wrap items-center gap-2">
        <UBadge :color="statusMeta(session.status).color" variant="subtle">
          {{ statusMeta(session.status).label }}
        </UBadge>
        <UBadge v-if="session.published" color="primary" variant="outline">
          Visible sur la page publique
        </UBadge>
        <UButton
          v-if="!isEditingDetails"
          icon="i-heroicons-pencil-square"
          color="primary"
          @click="startEditDetails"
        >
          Modifier
        </UButton>
        <UButton
          v-if="!isEditingDetails && canPostpone"
          icon="i-heroicons-calendar-days"
          color="neutral"
          variant="soft"
          @click="showPostpone = true"
        >
          Reporter
        </UButton>
        <UButton
          v-if="!isEditingDetails && session.status === SESSION_STATUSES.cancelled"
          icon="i-heroicons-envelope"
          color="neutral"
          variant="soft"
          @click="showCancellation = true"
        >
          Prévenir l’équipe
        </UButton>
      </div>
    </div>

    <SessionForm
      v-if="session && isEditingDetails && editableSession"
      v-model:session="editableSession"
      :games="games"
      :characters="characters"
      :locations="locations"
      :participants="participants"
      mode="edit"
      @submit="saveDetails"
      @cancel="cancelEditDetails"
    />

    <div v-if="session && !isEditingDetails" class="flex flex-wrap gap-2">
      <UButton
        v-for="tab in visibleTabs"
        :key="tab.key"
        :color="activeTab === tab.key ? 'primary' : 'neutral'"
        :variant="activeTab === tab.key ? 'solid' : 'soft'"
        @click="setTab(tab.key)"
      >
        {{ tab.label }}
      </UButton>
    </div>

    <SessionAttendanceManager
      v-if="session && !isEditingDetails && activeTab === 'presence' && session.postponedFrom"
      :session="session"
      @changed="loadData"
    />

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
      :default-email="currentUserEmail"
      :on-refresh="refreshDocumentsData"
    />

    <SessionAllergySheet
      v-if="session && !isEditingDetails && activeTab === 'documents'"
      :session-id="session.id"
    />

    <SessionPaymentsManager
      v-if="session && !isEditingDetails && activeTab === 'payments' && paymentsData"
      :payments-data="paymentsData"
      :default-email="currentUserEmail"
      :on-refresh="refreshPaymentsData"
    />

    <UCard v-if="!session">
      {{ loadError || 'Chargement...' }}
    </UCard>
    <SessionPostponeModal v-model:open="showPostpone" :session="session" :locations="locations" @postponed="onPostponed" />
    <SessionCancellationModal v-model:open="showCancellation" :session="session" :default-email="currentUserEmail" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import SessionCastForm, { type CastLine } from '@/components/SessionCastForm.vue'
import SessionForm from '@/components/SessionForm.vue'
import SessionTimelineForm from '@/components/SessionTimelineForm.vue'
import SessionDocumentsManager from '@/components/SessionDocumentsManager.vue'
import SessionPaymentsManager from '@/components/SessionPaymentsManager.vue'
import { SESSION_STATUSES } from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import { isOfflineMissing } from '~/utils/connection'
import { formatSessionDate as formatDate, sessionFormPayload, sessionStatusMeta as statusMeta, toDatetimeLocal } from '~/utils/sessions'
import { projectOfflineSession, projectOfflineTimeline } from '~/utils/sessionOffline'
import { saveCachedResponse } from '~/utils/storage'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { SessionDraft } from '~/utils/writingDrafts'
import type { SessionDocumentsData } from '~/composables/useSessionDocumentActions'
import type { SessionPaymentsData } from '~/composables/useSessionPaymentActions'

// Session lue par l'API, ou projetée hors ligne après une modification mise en file (US-048)
type SessionDetail = ApiResponse<'/api/sessions/:id'> | ReturnType<typeof projectOfflineSession<ApiResponse<'/api/sessions/:id'>>>
type Timeline = ApiResponse<'/api/sessions/:id/timeline'> | ReturnType<typeof projectOfflineTimeline<ApiResponse<'/api/sessions/:id/timeline'>>>
type Tab = 'timeline' | 'documents' | 'payments' | 'cast' | 'presence'

const route = useRoute()
const router = useRouter()
const session = ref<SessionDetail | null>(null)
const games = ref<ApiResponse<'/api/games'>>([])
const characters = ref<ApiResponse<'/api/characters'>>([])
const locations = ref<ApiResponse<'/api/locations'>>([])
const participants = ref<ApiResponse<'/api/participants'>>([])
const timelineData = ref<Timeline | null>(null)
const documentsData = ref<SessionDocumentsData | null>(null)
const paymentsData = ref<SessionPaymentsData | null>(null)
const currentUserEmail = ref('')
const loadError = ref('')
const TABS: Array<{ key: Tab, label: string }> = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'documents', label: 'Documents' },
  { key: 'payments', label: 'Paiements' },
  { key: 'cast', label: 'Cast' },
  { key: 'presence', label: 'Présence' }
]
// Présence : pour une session issue d'un report seulement (US-024)
const visibleTabs = computed(() => TABS.filter((tab) => tab.key !== 'presence' || session.value?.postponedFrom))
const tabOf = (value: unknown): Tab => TABS.find((tab) => tab.key === value)?.key ?? 'cast'
const activeTab = ref<Tab>(tabOf(route.query.tab))
const { isEditing: isEditingDetails, draft: editableSession, startEdit: startEditDetails, cancelEdit: cancelEditDetails, closeAfterSave } = useSheetEdit<SessionDraft>(() => session.value ? sessionFormPayload(session.value) : null, 'details')

// Report (US-022) : depuis une session prévue ou annulée
const showPostpone = ref(false)
// Session qui vient d'être annulée : on propose l'email à l'équipe (US-025)
const showCancellation = ref(false)
const canPostpone = computed(() => session.value?.status === SESSION_STATUSES.scheduled || session.value?.status === SESSION_STATUSES.cancelled)

async function onPostponed(created: { slug: string }) {
  // Nouvelle session : on y demande aussitôt la confirmation de présence (US-024)
  await router.push({ path: `/sessions/${created.slug}`, query: { tab: 'presence' } })
}

// La session se lit par le slug de la page, le reste par son identifiant : un slug change avec le nom. Toutes les
// lectures gardent leur copie sur l'appareil : sans réseau, la session se rouvre telle qu'elle a été vue (US-047)
const sessionBySlug = () => `/api/sessions/slug/${route.params.slug}`
const sessionApi = (path: string, id = session.value?.id) => `/api/sessions/${id}${path}`
function offlineRead<T>(request: string) {
  return fetchByUrl<T>(request, { offlineCache: true })
}

// Modification partie en file hors ligne : la page et sa copie sur l'appareil montrent aussitôt le résultat (US-048)
async function keepOffline<T>(request: string, value: T) {
  await saveCachedResponse(request, value)
  return value
}

const offlineLookup = () => ({ characters: characters.value, participants: participants.value, locations: locations.value })

async function loadData() {
  loadError.value = ''
  try {
    const [sessionData, gamesData, charactersData, locationsData, participantsData, authData] = await Promise.all([
      offlineRead<ApiResponse<'/api/sessions/slug/:slug'>>(sessionBySlug()),
      offlineRead<ApiResponse<'/api/games'>>('/api/games'),
      offlineRead<ApiResponse<'/api/characters'>>('/api/characters'),
      offlineRead<ApiResponse<'/api/locations'>>('/api/locations'),
      offlineRead<ApiResponse<'/api/participants'>>('/api/participants'),
      offlineRead<ApiResponse<'/api/auth/me'>>('/api/auth/me')
    ])
    const [timelineSessionData, sessionDocumentsData, sessionPaymentsData] = await Promise.all([
      offlineRead<ApiResponse<'/api/sessions/:id/timeline'>>(sessionApi('/timeline', sessionData.id)),
      offlineRead<SessionDocumentsData>(sessionApi('/documents', sessionData.id)),
      offlineRead<SessionPaymentsData>(sessionApi('/payments', sessionData.id))
    ])
    session.value = sessionData
    games.value = gamesData
    characters.value = charactersData
    locations.value = locationsData
    participants.value = participantsData
    timelineData.value = timelineSessionData
    documentsData.value = sessionDocumentsData
    paymentsData.value = sessionPaymentsData
    currentUserEmail.value = authData.authenticated ? authData.user.email : ''
    editableSession.value = sessionFormPayload(sessionData)
  } catch (err) {
    loadError.value = isOfflineMissing(err)
      ? 'Cette session n’a pas été consultée avec le réseau sur cet appareil : elle n’est pas disponible hors ligne.'
      : apiErrorMessage(err, 'Erreur inconnue')
  }
}

// Session enregistrée : la réponse du serveur, ou hors ligne la session projetée depuis ce qui est parti en file
async function saveSession(body: Parameters<typeof projectOfflineSession>[1] & Record<string, unknown>) {
  if (!session.value) return
  const saved = await useApiFetch(`/api/sessions/${session.value.id}`, { method: 'PUT', body })
  session.value = isOfflineQueued(saved)
    ? await keepOffline(sessionBySlug(), projectOfflineSession(session.value, body, offlineLookup()))
    : saved
}

async function saveCast(assignments: CastLine[]) {
  if (!session.value) return

  await saveSession({
    name: session.value.name,
    gameId: session.value.gameId,
    date: toDatetimeLocal(session.value.date),
    locationId: session.value.locationId || '',
    status: session.value.status || SESSION_STATUSES.scheduled,
    published: session.value.published,
    // Version lue : refus si la session a changé entre-temps (US-018, ADR-0028)
    updatedAt: session.value.updatedAt,
    participants: session.value.participants?.flatMap((participant) => {
      const participantId = participant.participantId || participant.participant?.id
      return participantId ? [{ participantId, role: participant.role }] : []
    }) || [],
    assignments
  })
}

async function saveTimeline(assignments: Array<{ timelineEventId: string, participantIds: string[] }>) {
  if (!session.value || !timelineData.value) return

  const saved = await useApiFetch(`/api/sessions/${session.value.id}/timeline`, {
    method: 'PUT',
    body: { assignments, updatedAt: session.value.updatedAt }
  })
  if (isOfflineQueued(saved)) {
    // La version reste celle lue : la file la reprendra à l'envoi (ADR-0036)
    timelineData.value = await keepOffline(sessionApi('/timeline'), projectOfflineTimeline(timelineData.value, assignments, offlineLookup()))
    return
  }
  // Le déroulé change la version de la session : la garder pour les enregistrements suivants
  session.value = { ...session.value, updatedAt: saved.updatedAt }
  if (editableSession.value) editableSession.value.updatedAt = saved.updatedAt
  timelineData.value = await offlineRead<ApiResponse<'/api/sessions/:id/timeline'>>(sessionApi('/timeline'))
}

async function refreshDocumentsData() {
  if (!session.value) return
  documentsData.value = await offlineRead<SessionDocumentsData>(sessionApi('/documents'))
}

async function refreshPaymentsData() {
  if (!session.value) return
  paymentsData.value = await offlineRead<SessionPaymentsData>(sessionApi('/payments'))
}

watch(() => route.query.tab, (value) => {
  activeTab.value = tabOf(value)
})

// Passage à une autre session sur la même page (lien de report, US-022) : on recharge ses données
watch(() => route.params.slug, (value, previous) => {
  if (value && value !== previous && value !== session.value?.slug) loadData()
})

function setTab(tab: Tab) {
  activeTab.value = tab
  router.replace({ path: route.path, query: { ...route.query, tab } })
}

async function saveDetails() {
  if (!editableSession.value?.id) return

  const previousStatus = session.value?.status
  await saveSession(editableSession.value)
  if (!session.value) return
  const cancelled = previousStatus !== SESSION_STATUSES.cancelled && session.value.status === SESSION_STATUSES.cancelled
  // Nouveau slug : la page passe à sa nouvelle adresse et relit tout depuis elle, pour que la copie de l'appareil
  // retrouve la session à cette adresse hors ligne
  const previousPath = route.path
  await closeAfterSave(`/sessions/${session.value.slug}`)
  if (route.path !== previousPath) {
    await loadData()
  } else {
    timelineData.value = await offlineRead<ApiResponse<'/api/sessions/:id/timeline'>>(sessionApi('/timeline'))
    await refreshDocumentsData()
    await refreshPaymentsData()
  }
  if (cancelled) showCancellation.value = true
}

onMounted(loadData)
</script>
