<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">{{ gameTitle }}</h2>
          <p class="text-sm text-gray-500">
            {{ periods.length }} période{{ periods.length > 1 ? 's' : '' }} d’inscription
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton icon="i-heroicons-clipboard-document-list" color="neutral" variant="soft" @click="showFormEditor = true">
            Formulaire
          </UButton>
          <UButton icon="i-heroicons-plus" color="primary" @click="edit(null)">
            Nouvelle période d’inscription
          </UButton>
        </div>
      </div>
    </template>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      class="mb-4"
      :description="errorMessage"
    />

    <div class="space-y-3">
      <div
        v-for="period in periods"
        :key="period.id"
        class="rounded border border-gray-200 p-4"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ period.name }}</span>
              <UBadge :color="stateMeta(period).color" variant="subtle">{{ stateMeta(period).label }}</UBadge>
            </div>
            <ul class="text-sm text-gray-600">
              <li v-for="link in period.sessions" :key="link.sessionId">
                {{ link.session.name }}<span v-if="link.session.date"> · {{ formatDate(link.session.date) }}</span>
                · {{ link.seats }} place{{ link.seats > 1 ? 's' : '' }}
              </li>
            </ul>
            <p class="text-xs text-gray-500">
              Délai de réponse : {{ period.responseDelayDays }} jour{{ period.responseDelayDays > 1 ? 's' : '' }}
              <span v-if="period.closesAt"> · clôture le {{ formatDateTime(period.closesAt) }}</span>
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="period.effectiveState === REGISTRATION_PERIOD_STATES.draft"
              size="sm"
              color="success"
              variant="soft"
              @click="setState(period, REGISTRATION_PERIOD_STATES.open)"
            >
              Ouvrir
            </UButton>
            <UButton
              v-else-if="period.effectiveState === REGISTRATION_PERIOD_STATES.open"
              size="sm"
              color="warning"
              variant="soft"
              @click="setState(period, REGISTRATION_PERIOD_STATES.closed)"
            >
              Clôturer
            </UButton>
            <UButton
              v-else
              size="sm"
              color="neutral"
              variant="soft"
              @click="reopen(period)"
            >
              Rouvrir
            </UButton>
            <UButton size="sm" color="neutral" variant="soft" icon="i-heroicons-pencil-square" @click="edit(period)">
              Modifier
            </UButton>
            <UButton size="sm" color="error" variant="soft" icon="i-heroicons-trash" @click="remove(period)">
              Supprimer
            </UButton>
          </div>
        </div>
      </div>

      <p v-if="!periods.length" class="text-sm text-gray-500">
        Aucune période d’inscription pour ce jeu.
      </p>
    </div>

    <RegistrationPeriodForm
      v-model:open="showForm"
      :game-id="gameId"
      :period="editedPeriod"
      @saved="refresh"
    />
    <RegistrationFormEditor v-model:open="showFormEditor" :game-id="gameId" />
  </UCard>
</template>

<script setup>
import { REGISTRATION_PERIOD_STATE_META, REGISTRATION_PERIOD_STATES } from '~/utils/domain'

// Bloc d'un jeu sur la page Inscriptions (R33) : ses périodes d'inscription
const props = defineProps({
  gameId: { type: String, required: true },
  gameTitle: { type: String, required: true }
})

const periods = ref([])
const errorMessage = ref('')
const showForm = ref(false)
const editedPeriod = ref(null)
const showFormEditor = ref(false)

await refresh()

async function refresh() {
  try {
    periods.value = await useApiFetch(`/api/registration-periods?gameId=${encodeURIComponent(props.gameId)}`)
    errorMessage.value = ''
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Impossible de charger les périodes d’inscription'
  }
}

function stateMeta(period) {
  return REGISTRATION_PERIOD_STATE_META[period.effectiveState] || REGISTRATION_PERIOD_STATE_META.draft
}

function edit(period) {
  editedPeriod.value = period
  showForm.value = true
}

function periodBody(period, changes) {
  return {
    name: period.name,
    gameId: period.gameId,
    state: period.state,
    closesAt: period.closesAt,
    responseDelayDays: period.responseDelayDays,
    sessions: period.sessions.map((link) => ({ sessionId: link.sessionId, seats: link.seats })),
    updatedAt: period.updatedAt,
    ...changes
  }
}

async function save(period, changes) {
  try {
    await useApiFetch(`/api/registration-periods/${period.id}`, { method: 'PUT', body: periodBody(period, changes) })
    await refresh()
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Modification impossible'
  }
}

async function setState(period, state) {
  await save(period, { state })
}

// Une date de clôture passée garderait la période clôturée (ADR-0020) : la rouvrir retire cette date
async function reopen(period) {
  const closedByDate = Boolean(period.closesAt) && new Date(period.closesAt).getTime() <= Date.now()
  if (closedByDate && !confirm('La date de clôture de cette période est passée. La rouvrir retire cette date. Continuer ?')) return
  await save(period, { state: REGISTRATION_PERIOD_STATES.open, ...(closedByDate ? { closesAt: null } : {}) })
}

async function remove(period) {
  if (!confirm(`Supprimer la période d’inscription « ${period.name} » ?`)) return
  try {
    await useApiFetch(`/api/registration-periods/${period.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Suppression impossible'
  }
}

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long' })
const formatDateTime = (value) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
</script>
