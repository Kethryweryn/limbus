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
    <UAlert
      v-if="infoMessage"
      :color="infoColor"
      variant="soft"
      class="mb-4"
      :description="infoMessage"
      :close="{ color: 'neutral', variant: 'link' }"
      @update:open="infoMessage = ''"
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

        <div v-for="link in period.sessions" :key="`registrations-${link.sessionId}`" class="mt-4 space-y-2 border-t border-gray-100 pt-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-700">
              {{ link.session.name }} · {{ invitedCount(period, link.sessionId) }} invitation{{ invitedCount(period, link.sessionId) > 1 ? 's' : '' }}
              pour {{ link.seats }} place{{ link.seats > 1 ? 's' : '' }}
            </h3>
            <UButton
              size="xs"
              icon="i-heroicons-envelope"
              color="primary"
              variant="soft"
              :disabled="period.effectiveState !== REGISTRATION_PERIOD_STATES.open"
              :title="period.effectiveState === REGISTRATION_PERIOD_STATES.open ? undefined : 'Ouvrez la période pour inviter'"
              @click="invite(period, link)"
            >
              Inviter
            </UButton>
          </div>
          <p v-if="invitedCount(period, link.sessionId) > link.seats" class="text-xs text-warning-600">
            Plus d’invitations que de places.
          </p>
          <ul v-if="sessionRegistrations(period, link.sessionId).length" class="divide-y divide-gray-100 text-sm">
            <li
              v-for="registration in sessionRegistrations(period, link.sessionId)"
              :key="registration.id"
              class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <span class="font-medium text-gray-800">{{ registration.participant.name }}</span>
                <UBadge class="ml-2" size="sm" :color="statusMeta(registration).color" variant="subtle">{{ statusMeta(registration).label }}</UBadge>
                <div class="text-xs text-gray-500">
                  {{ registration.email }}
                  <template v-if="registration.status === REGISTRATION_STATUSES.withdrawn">
                    · {{ withdrawalLabel(registration) }}
                  </template>
                  <template v-else>
                    <span v-if="registration.invitationSentAt"> · invitée le {{ formatDate(registration.invitationSentAt) }}</span>
                    <span v-else class="text-warning-600"> · email non envoyé</span>
                    <span v-if="registration.confirmedAt"> · confirmée le {{ formatDate(registration.confirmedAt) }}</span>
                    <span v-else-if="registration.responseDueAt"> · réponse avant le {{ formatDate(registration.responseDueAt) }}</span>
                  </template>
                </div>
              </div>
              <div v-if="registration.status === REGISTRATION_STATUSES.invited" class="flex shrink-0 gap-2">
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-arrow-path" @click="resend(registration)">
                  Renvoyer
                </UButton>
                <UButton size="xs" color="error" variant="soft" icon="i-heroicons-x-mark" @click="cancel(registration)">
                  Annuler
                </UButton>
              </div>
            </li>
          </ul>
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
    <RegistrationFormEditor v-model:open="showFormEditor" :game-id="gameId" :game-title="gameTitle" />
    <RegistrationInviteForm
      v-if="inviteTarget"
      v-model:open="showInviteForm"
      :game-id="gameId"
      :period-id="inviteTarget.period.id"
      :session-id="inviteTarget.link.sessionId"
      :session-name="inviteTarget.link.session.name"
      :seats="inviteTarget.link.seats"
      :invited-count="invitedCount(inviteTarget.period, inviteTarget.link.sessionId)"
      :registered-participant-ids="registeredParticipantIds(inviteTarget.period)"
      :withdrawn-participant-ids="withdrawnParticipantIds(inviteTarget.period)"
      @invited="invited"
    />
  </UCard>
</template>

<script setup>
import {
  REGISTRATION_PERIOD_STATE_META,
  REGISTRATION_PERIOD_STATES,
  REGISTRATION_STATUS_META,
  REGISTRATION_STATUSES
} from '~/utils/domain'

// Bloc d'un jeu sur la page Inscriptions (R33) : ses périodes d'inscription et son formulaire (US-002)
const props = defineProps({
  gameId: { type: String, required: true },
  gameTitle: { type: String, required: true },
  // Périodes déjà chargées par la page, avec leurs inscriptions
  initialPeriods: { type: Array, default: null }
})

const periods = ref([])
const errorMessage = ref('')
const showForm = ref(false)
const editedPeriod = ref(null)
const showFormEditor = ref(false)
const registrationsByPeriod = ref({})
const showInviteForm = ref(false)
const inviteTarget = ref(null)
const infoMessage = ref('')
const infoColor = ref('success')

if (props.initialPeriods) applyPeriods(props.initialPeriods)
else await refresh()

function applyPeriods(list) {
  periods.value = list
  registrationsByPeriod.value = Object.fromEntries(list.map((period) => [period.id, period.registrations || []]))
}

async function refresh() {
  try {
    applyPeriods(await useApiFetch(`/api/registration-periods?gameId=${encodeURIComponent(props.gameId)}&include=registrations`))
    errorMessage.value = ''
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Impossible de charger les périodes d’inscription'
  }
}

function sessionRegistrations(period, sessionId) {
  return (registrationsByPeriod.value[period.id] || []).filter((registration) => registration.sessionId === sessionId)
}

// Une personne désistée libère sa place : elle ne compte plus face aux places
function invitedCount(period, sessionId) {
  return sessionRegistrations(period, sessionId).filter((registration) => registration.status !== REGISTRATION_STATUSES.withdrawn).length
}

// Une personne qui a décliné ou s'est désistée peut être réinvitée (erreur de sa part) ; les autres ont déjà leur inscription
function registeredParticipantIds(period) {
  return (registrationsByPeriod.value[period.id] || [])
    .filter((registration) => registration.status !== REGISTRATION_STATUSES.withdrawn)
    .map((registration) => registration.participant.id)
}

function withdrawnParticipantIds(period) {
  return (registrationsByPeriod.value[period.id] || [])
    .filter((registration) => registration.status === REGISTRATION_STATUSES.withdrawn)
    .map((registration) => registration.participant.id)
}

// Refus d'une invitation, désistement par le lien, ou retrait par une organisatrice (US-005)
function withdrawalLabel(registration) {
  const date = formatDate(registration.withdrawnAt || registration.respondedAt)
  if (registration.withdrawnBy) return `retirée le ${date} par ${registration.withdrawnBy.name}`
  return registration.confirmedAt ? `désistée le ${date} par la personne` : `invitation déclinée le ${date}`
}

function statusMeta(registration) {
  return REGISTRATION_STATUS_META[registration.status] || { label: registration.status, color: 'neutral' }
}

function invite(period, link) {
  inviteTarget.value = { period, link }
  showInviteForm.value = true
}

const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`

async function invited(result) {
  const failures = result.failures.map((failure) => `${failure.participantName} (${failure.message})`)
  infoColor.value = failures.length ? 'warning' : 'success'
  infoMessage.value = [
    `${plural(result.invitedCount, 'invitation')}, ${plural(result.sentCount, 'email')} envoyé${result.sentCount > 1 ? 's' : ''}.`,
    failures.length ? `Non envoyés : ${failures.join(', ')}. Utilisez « Renvoyer » une fois le problème réglé.` : ''
  ].filter(Boolean).join(' ')
  await refresh()
}

async function resend(registration) {
  if (!confirm(`Renvoyer l’invitation à ${registration.participant.name} ? Le lien envoyé précédemment ne fonctionnera plus.`)) return
  try {
    await useApiFetch(`/api/registrations/${registration.id}/resend`, { method: 'POST' })
    await refresh()
    infoColor.value = 'success'
    infoMessage.value = `Invitation renvoyée à ${registration.participant.name}.`
  } catch (err) {
    // Même en échec d'envoi, l'ancien lien est invalidé : on recharge avant d'afficher l'erreur
    await refresh()
    errorMessage.value = err?.data?.message || err?.message || 'Renvoi impossible'
  }
}

async function cancel(registration) {
  if (!confirm(`Annuler l’invitation de ${registration.participant.name} ? Son lien ne fonctionnera plus.`)) return
  try {
    await useApiFetch(`/api/registrations/${registration.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Annulation impossible'
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
