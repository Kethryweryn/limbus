<template>
  <!-- Sélection d'une période en mode formulaire (US-087 à US-090) : trier, puis annoncer -->
  <div class="mt-4 space-y-4 border-t border-gray-100 pt-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold text-gray-700">
          {{ permanent ? 'Vivier' : 'Sélection' }} · {{ activeCount }} inscription{{ activeCount > 1 ? 's' : '' }}
        </h3>
        <p class="text-xs text-gray-500">
          Les décisions ne préviennent personne : « Annoncer les résultats » envoie les emails.
          <span v-if="overview?.replayPolicy === REGISTRATION_REPLAY_POLICIES.flagged"> Les rejoueurs sont signalés.</span>
          <span v-else-if="overview?.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded"> Les rejoueurs sont exclus du tirage{{ permanent ? ' et du vivier' : '' }}.</span>
        </p>
      </div>
      <UButton
        size="sm"
        icon="i-heroicons-megaphone"
        color="primary"
        :disabled="!pendingCount"
        :loading="announcing"
        @click="announce"
      >
        Annoncer les résultats{{ pendingCount ? ` (${pendingCount})` : '' }}
      </UButton>
    </div>

    <UAlert v-if="message" :color="messageColor" variant="soft" :description="message" :close="{ color: 'neutral', variant: 'link' }" @update:open="message = ''" />

    <p v-if="permanent && !sessions.length" class="text-sm text-gray-500">
      Aucune session à venir sans période dédiée : créez une session pour y retenir des personnes du vivier.
    </p>

    <div v-for="session in sessions" :key="session.id" class="space-y-2 rounded border border-gray-100 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-medium text-gray-800">
          {{ session.name }}<span v-if="session.date" class="text-gray-500"> · {{ formatDate(session.date) }}</span>
          ·
          <span :class="session.taken >= session.seats ? 'text-warning-600' : 'text-gray-600'">
            {{ session.taken }} / {{ session.seats }} place{{ session.seats > 1 ? 's' : '' }}
          </span>
        </h4>
        <UButton v-if="permanent" size="xs" color="neutral" variant="soft" icon="i-heroicons-pencil-square" @click="editSeats(session)">
          Places
        </UButton>
      </div>

      <ul v-if="placed(session).length" class="divide-y divide-gray-100 text-sm">
        <li v-for="registration in placed(session)" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
          <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" />
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="emit('detail', registration)">Détail</UButton>
            <template v-if="registration.status === REGISTRATION_STATUSES.retained">
              <template v-if="awaiting(registration)">
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-bell-alert" @click="emit('remind', registration)">Relancer</UButton>
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-arrow-path" @click="emit('resend', registration)">Nouveau lien</UButton>
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-calendar-days" @click="emit('extend', registration)">Prolonger</UButton>
                <UButton size="xs" color="warning" variant="soft" icon="i-heroicons-user-minus" @click="emit('release', registration)">Libérer</UButton>
              </template>
              <UDropdownMenu :items="decisionItems(registration)">
                <UButton size="xs" color="neutral" variant="soft" trailing-icon="i-heroicons-chevron-down">Changer</UButton>
              </UDropdownMenu>
            </template>
            <UButton
              v-else
              size="xs"
              color="error"
              variant="soft"
              icon="i-heroicons-user-minus"
              @click="emit('withdraw', registration)"
            >
              Retirer
            </UButton>
          </div>
        </li>
      </ul>

      <div v-if="waiting(session).length" class="space-y-1">
        <p class="text-xs font-semibold text-gray-600">Liste d’attente</p>
        <!-- Une place libre propose la première personne de la file (R21) : l'équipe la retient, puis l'annonce -->
        <UAlert
          v-if="session.taken < session.seats"
          color="info"
          variant="soft"
          :description="`Une place est libre : retenir ${waiting(session)[0].participant.name}, première de la liste d’attente ?`"
          :actions="[{ label: 'Retenir', color: 'primary', variant: 'solid', size: 'xs', onClick: () => decide(waiting(session)[0], 'retain', session.id) }]"
        />
        <ol class="divide-y divide-gray-100 text-sm">
          <li v-for="(registration, index) in waiting(session)" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 items-start gap-2">
              <span class="w-5 shrink-0 text-right text-xs text-gray-500">{{ index + 1 }}.</span>
              <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" />
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-up" :disabled="index === 0" aria-label="Monter" @click="move(session, index, -1)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-down" :disabled="index === waiting(session).length - 1" aria-label="Descendre" @click="move(session, index, 1)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="emit('detail', registration)">Détail</UButton>
              <UButton size="xs" color="primary" variant="soft" :disabled="session.taken >= session.seats" @click="decide(registration, 'retain', session.id)">Retenir</UButton>
              <UDropdownMenu :items="decisionItems(registration)">
                <UButton size="xs" color="neutral" variant="soft" trailing-icon="i-heroicons-chevron-down">Changer</UButton>
              </UDropdownMenu>
            </div>
          </li>
        </ol>
      </div>
      <p v-if="!placed(session).length && !waiting(session).length" class="text-xs text-gray-500">Personne pour l’instant.</p>
    </div>

    <div class="space-y-1">
      <p class="text-xs font-semibold text-gray-600">{{ permanent ? 'Dans le vivier' : 'À trier' }} : {{ toSort.length }}</p>
      <ul v-if="toSort.length" class="divide-y divide-gray-100 text-sm">
        <li v-for="registration in toSort" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
          <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" :availability="availabilityLabel(registration)" />
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="emit('detail', registration)">Détail</UButton>
            <UDropdownMenu :items="decisionItems(registration)">
              <UButton size="xs" color="primary" variant="soft" trailing-icon="i-heroicons-chevron-down">Décider</UButton>
            </UDropdownMenu>
            <UButton size="xs" color="error" variant="soft" icon="i-heroicons-user-minus" @click="emit('withdraw', registration)">Retirer</UButton>
          </div>
        </li>
      </ul>
      <p v-else class="text-xs text-gray-500">{{ registrations.length ? 'Toutes les inscriptions sont triées.' : 'Aucune inscription pour l’instant : partagez le lien de diffusion.' }}</p>
      <p v-if="outOfPool.length" class="text-xs text-gray-500">
        Hors du vivier, car elles ont déjà joué : {{ outOfPool.map((registration) => registration.participant.name).join(', ') }}.
      </p>
    </div>

    <div v-if="rejected.length" class="space-y-1">
      <p class="text-xs font-semibold text-gray-600">Non retenues : {{ rejected.length }}</p>
      <ul class="divide-y divide-gray-100 text-sm">
        <li v-for="registration in rejected" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
          <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" />
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="emit('detail', registration)">Détail</UButton>
            <UDropdownMenu :items="decisionItems(registration)">
              <UButton size="xs" color="neutral" variant="soft" trailing-icon="i-heroicons-chevron-down">Changer</UButton>
            </UDropdownMenu>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="withdrawn.length" class="space-y-1">
      <p class="text-xs font-semibold text-gray-600">Désistées : {{ withdrawn.length }}</p>
      <ul class="text-sm text-gray-600">
        <li v-for="registration in withdrawn" :key="registration.id">{{ registration.participant.name }}</li>
      </ul>
    </div>

    <UModal v-model:open="showSeats" :title="seatsTarget ? `Places de ${seatsTarget.name}` : 'Places'">
      <template #body>
        <form class="space-y-4" @submit.prevent="saveSeats">
          <UFormField label="Nombre de places" description="Vide : le nombre de personnages PJ du jeu." :error="seatsError || undefined">
            <UInput v-model="seatsValue" type="number" min="0" max="1000" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="showSeats = false">Annuler</UButton>
            <UButton type="submit" color="primary" :loading="savingSeats">Enregistrer</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup>
import { REGISTRATION_PERIOD_SCOPES, REGISTRATION_REPLAY_POLICIES, REGISTRATION_STATUSES } from '~/utils/domain'
import { canConfirmPlace, isAnnouncementPending, isBackInPool } from '~/utils/registrations'
import { apiErrorMessage } from '~/utils/apiErrors'

const props = defineProps({
  period: { type: Object, required: true },
  registrations: { type: Array, default: () => [] }
})
// Relance, nouveau lien, prolongation, libération et retrait passent par les actions de la page (US-005)
const emit = defineEmits(['changed', 'detail', 'remind', 'resend', 'extend', 'release', 'withdraw'])

const overview = ref(null)
const message = ref('')
const messageColor = ref('success')
const announcing = ref(false)

async function loadOverview() {
  try {
    overview.value = await useApiFetch(`/api/registration-periods/${props.period.id}/selection`)
  } catch (err) {
    messageColor.value = 'error'
    message.value = apiErrorMessage(err, 'Impossible de charger la sélection')
  }
}
// Chargée après le montage : une période créée plus tard monte ce bloc sans attente asynchrone
onMounted(loadOverview)
watch(() => props.registrations, loadOverview)

const permanent = computed(() => props.period.scope === REGISTRATION_PERIOD_SCOPES.game)
const sessions = computed(() => overview.value?.sessions ?? [])
const replayers = computed(() => new Set(overview.value?.replayerParticipantIds ?? []))
const sessionIds = computed(() => new Set(sessions.value.map((session) => session.id)))
const isReplayer = (registration) => replayers.value.has(registration.participant.id)
const pendingCount = computed(() => props.registrations.filter(isAnnouncementPending).length)
const activeCount = computed(() => props.registrations.filter((registration) => registration.status !== REGISTRATION_STATUSES.withdrawn).length)

// Une place retenue ou confirmée dans une session passée ou annulée remet la personne dans le vivier (ADR-0047)
const backInPool = (registration) => permanent.value && isBackInPool(registration)
// En attente seulement dans des sessions passées : de nouveau à trier
const waitingNowhere = (registration) => registration.status === REGISTRATION_STATUSES.waitlisted
  && !(registration.waitlistEntries || []).some((entry) => sessionIds.value.has(entry.sessionId))
const excludedFromPool = (registration) => permanent.value && overview.value?.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded && isReplayer(registration)

const placed = (session) => props.registrations
  .filter((registration) => registration.sessionId === session.id && [REGISTRATION_STATUSES.retained, REGISTRATION_STATUSES.confirmed].includes(registration.status))

const waiting = (session) => props.registrations
  .filter((registration) => registration.status === REGISTRATION_STATUSES.waitlisted)
  .map((registration) => ({ registration, entry: registration.waitlistEntries.find((entry) => entry.sessionId === session.id) }))
  .filter(({ entry }) => entry)
  .sort((left, right) => left.entry.position - right.entry.position)
  .map(({ registration }) => registration)

const sortable = computed(() => props.registrations.filter((registration) => registration.status === REGISTRATION_STATUSES.received || backInPool(registration) || waitingNowhere(registration)))
const toSort = computed(() => sortable.value.filter((registration) => !excludedFromPool(registration)))
const outOfPool = computed(() => sortable.value.filter(excludedFromPool))
const rejected = computed(() => props.registrations.filter((registration) => registration.status === REGISTRATION_STATUSES.rejected))
const withdrawn = computed(() => props.registrations.filter((registration) => registration.status === REGISTRATION_STATUSES.withdrawn))

const awaiting = (registration) => canConfirmPlace(registration)

// Une période à plusieurs sessions demande les disponibilités (R10) ; l'inscription permanente, non
function available(registration, session) {
  if (permanent.value || props.period.sessions.length <= 1) return true
  return (registration.availabilities || []).some((availability) => availability.sessionId === session.id)
}

function availabilityLabel(registration) {
  if (permanent.value || props.period.sessions.length <= 1) return ''
  return sessions.value.filter((session) => available(registration, session)).map((session) => session.name).join(', ')
}

function decisionItems(registration) {
  const targets = sessions.value.filter((session) => available(registration, session))
  const waitingIn = new Set((registration.waitlistEntries || []).map((entry) => entry.sessionId))
  const retainHere = (session) => registration.status === REGISTRATION_STATUSES.retained && registration.sessionId === session.id
  const groups = [
    targets.filter((session) => !retainHere(session)).map((session) => ({
      label: `Retenir pour ${session.name}`,
      icon: 'i-heroicons-check',
      disabled: session.taken >= session.seats,
      onSelect: () => decide(registration, 'retain', session.id)
    })),
    targets.map((session) => waitingIn.has(session.id)
      ? { label: `Sortir de la liste d’attente de ${session.name}`, icon: 'i-heroicons-minus', onSelect: () => decide(registration, 'unwaitlist', session.id) }
      : { label: `Liste d’attente de ${session.name}`, icon: 'i-heroicons-queue-list', onSelect: () => decide(registration, 'waitlist', session.id) })
  ]
  const others = []
  if (!permanent.value && registration.status !== REGISTRATION_STATUSES.rejected) {
    others.push({ label: 'Non retenue', icon: 'i-heroicons-x-mark', onSelect: () => decide(registration, 'reject') })
  }
  if (registration.status !== REGISTRATION_STATUSES.received && !backInPool(registration)) {
    others.push({ label: permanent.value ? 'Remettre dans le vivier' : 'Remettre à trier', icon: 'i-heroicons-arrow-uturn-left', onSelect: () => decide(registration, 'reset') })
  }
  return [...groups, others].filter((group) => group.length)
}

async function decide(registration, action, sessionId = null) {
  message.value = ''
  try {
    await useApiFetch(`/api/registrations/${registration.id}/selection`, { method: 'POST', body: { action, sessionId } })
  } catch (err) {
    messageColor.value = 'error'
    message.value = apiErrorMessage(err, 'Décision impossible')
  }
  emit('changed')
}

async function move(session, index, offset) {
  const ids = waiting(session).map((registration) => registration.id)
  const [moved] = ids.splice(index, 1)
  ids.splice(index + offset, 0, moved)
  try {
    await useApiFetch(`/api/registration-periods/${props.period.id}/waitlist`, { method: 'PUT', body: { sessionId: session.id, registrationIds: ids } })
  } catch (err) {
    messageColor.value = 'error'
    message.value = apiErrorMessage(err, 'Réordonnancement impossible')
  }
  emit('changed')
}

async function announce() {
  if (!confirm(`Prévenir ${pendingCount.value} personne${pendingCount.value > 1 ? 's' : ''} par email ? Chacune reçoit un nouveau lien personnel ; l’ancien ne fonctionnera plus.`)) return
  announcing.value = true
  message.value = ''
  try {
    const result = await useApiFetch(`/api/registration-periods/${props.period.id}/announce`, { method: 'POST' })
    const failures = result.failures.map((failure) => `${failure.participantName} (${failure.message})`)
    messageColor.value = failures.length ? 'warning' : 'success'
    message.value = [
      `${result.announcedCount} personne${result.announcedCount > 1 ? 's' : ''} prévenue${result.announcedCount > 1 ? 's' : ''}.`,
      failures.length ? `Non prévenues : ${failures.join(', ')}. Elles restent à annoncer.` : ''
    ].filter(Boolean).join(' ')
  } catch (err) {
    messageColor.value = 'error'
    message.value = apiErrorMessage(err, 'Annonce impossible')
  } finally {
    announcing.value = false
  }
  emit('changed')
}

const showSeats = ref(false)
const seatsTarget = ref(null)
const seatsValue = ref('')
const seatsError = ref('')
const savingSeats = ref(false)

function editSeats(session) {
  seatsTarget.value = session
  seatsValue.value = session.defaultSeats ? '' : String(session.seats)
  seatsError.value = ''
  showSeats.value = true
}

async function saveSeats() {
  savingSeats.value = true
  seatsError.value = ''
  try {
    const raw = String(seatsValue.value ?? '').trim()
    await useApiFetch(`/api/registration-periods/${props.period.id}/pool-seats`, {
      method: 'PUT',
      body: { sessionId: seatsTarget.value.id, seats: raw === '' ? null : Number(raw) }
    })
    showSeats.value = false
    await loadOverview()
  } catch (err) {
    seatsError.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    savingSeats.value = false
  }
}

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long' })
</script>
