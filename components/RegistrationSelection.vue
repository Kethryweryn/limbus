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
      <div class="flex flex-wrap gap-2">
        <!-- Tirage (US-093) : un seul actif ; pour refaire, on annule le précédent -->
        <UButton
          v-if="drawable"
          size="sm"
          icon="i-heroicons-sparkles"
          color="neutral"
          variant="soft"
          :disabled="Boolean(activeDraw)"
          :title="activeDraw ? 'Annulez le tirage en cours pour en refaire un' : undefined"
          :loading="drawing"
          @click="draw"
        >
          Tirer au sort
        </UButton>
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
    </div>
    <p v-if="drawable && !activeDraw" class="text-xs text-gray-500">
      <template v-if="period.selectionMode === REGISTRATION_SELECTION_MODES.mixed">
        Mode mixte : avant le tirage, chaque organisatrice retient jusqu’à {{ period.organizerPicks ?? 0 }} personne{{ (period.organizerPicks ?? 0) > 1 ? 's' : '' }} par session ; le tirage remplit le reste.
      </template>
      <template v-else>Sélection au hasard : lancez le tirage, puis corrigez à la main si besoin.</template>
    </p>

    <UAlert v-if="message" :color="messageColor" variant="soft" :description="message" :close="{ color: 'neutral', variant: 'link' }" @update:open="message = ''" />

    <p v-if="permanent && !sessions.length" class="text-sm text-gray-500">
      Aucune session à venir sans période dédiée : créez une session pour y retenir des personnes du vivier.
    </p>

    <div v-for="session in sessions" :key="session.id" class="space-y-2 rounded border border-gray-100 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-medium text-gray-800">
          {{ session.name }}<span v-if="session.date" class="text-gray-500"> · {{ formatLongDate(session.date) }}</span>
          ·
          <span :class="session.taken >= session.seats ? 'text-warning-600' : 'text-gray-600'">
            {{ session.taken }} / {{ session.seats }} place{{ session.seats > 1 ? 's' : '' }}
          </span>
        </h4>
        <UButton v-if="permanent" size="xs" color="neutral" variant="soft" icon="i-heroicons-pencil-square" @click="editSeats(session)">
          Places
        </UButton>
      </div>

      <!-- Affinités (US-096, R25) : prévenir sans bloquer -->
      <UAlert
        v-if="alertsOf(session).length"
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :description="alertsOf(session).map(alertText).join(' ')"
      />

      <ul v-if="placed(session).length" class="divide-y divide-gray-100 text-sm">
        <li v-for="registration in placed(session)" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
          <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" :alert="alerted(session, registration)" :wishes="wishLabels(registration, session)" :to-link="toLink(registration)" />
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">Détail</UButton>
            <template v-if="registration.status === REGISTRATION_STATUSES.retained">
              <template v-if="canConfirmPlace(registration)">
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-bell-alert" @click="remind(registration)">Relancer</UButton>
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-arrow-path" @click="resend(registration)">Nouveau lien</UButton>
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-calendar-days" @click="askExtension(registration)">Prolonger</UButton>
                <UButton size="xs" color="warning" variant="soft" icon="i-heroicons-user-minus" @click="release(registration)">Libérer</UButton>
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
              @click="withdraw(registration)"
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
          :description="`Une place est libre : retenir ${waiting(session)[0]!.participant.name}, première de la liste d’attente ?`"
          :actions="[{ label: 'Retenir', color: 'primary', variant: 'solid', size: 'xs', onClick: () => decide(waiting(session)[0]!, 'retain', session.id) }]"
        />
        <ol class="divide-y divide-gray-100 text-sm">
          <li v-for="(registration, index) in waiting(session)" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 items-start gap-2">
              <span class="w-5 shrink-0 text-right text-xs text-gray-500">{{ index + 1 }}.</span>
              <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" :wishes="wishLabels(registration)" :to-link="toLink(registration)" />
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-up" :disabled="index === 0" aria-label="Monter" @click="move(session, index, -1)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-down" :disabled="index === waiting(session).length - 1" aria-label="Descendre" @click="move(session, index, 1)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">Détail</UButton>
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
          <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" :wishes="wishLabels(registration)" :to-link="toLink(registration)" :availability="availabilityLabel(registration)" />
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">Détail</UButton>
            <UDropdownMenu :items="decisionItems(registration)">
              <UButton size="xs" color="primary" variant="soft" trailing-icon="i-heroicons-chevron-down">Décider</UButton>
            </UDropdownMenu>
            <UButton size="xs" color="error" variant="soft" icon="i-heroicons-user-minus" @click="withdraw(registration)">Retirer</UButton>
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
          <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" :wishes="wishLabels(registration)" :to-link="toLink(registration)" />
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">Détail</UButton>
            <UDropdownMenu :items="decisionItems(registration)">
              <UButton size="xs" color="neutral" variant="soft" trailing-icon="i-heroicons-chevron-down">Changer</UButton>
            </UDropdownMenu>
          </div>
        </li>
      </ul>
    </div>

    <!-- Journal des tirages (US-094, R18) : graine, réglages et résultat de chacun, annulés compris -->
    <div v-if="draws.length" class="space-y-2">
      <p class="text-xs font-semibold text-gray-600">Tirages</p>
      <div v-for="entry in draws" :key="entry.id" class="space-y-1 rounded border border-gray-100 p-2 text-xs text-gray-600">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>
            Le {{ formatLongDateTime(entry.createdAt) }}<span v-if="entry.createdBy"> par {{ entry.createdBy.name }}</span>
            · graine <code>{{ entry.seed }}</code>
            <UBadge v-if="entry.cancelledAt" class="ml-1" size="sm" color="neutral" variant="outline">
              Annulé le {{ formatLongDateTime(entry.cancelledAt) }}<span v-if="entry.cancelledBy">&nbsp;par {{ entry.cancelledBy.name }}</span>
            </UBadge>
          </span>
          <UButton v-if="!entry.cancelledAt" size="xs" color="warning" variant="soft" :loading="cancelling" @click="cancelDraw(entry)">
            Annuler ce tirage
          </UButton>
        </div>
        <p>
          {{ entry.settings.weightNotDrawnBefore ? 'Chances doublées pour les non retenus avant' : 'Sans priorité' }} ·
          {{ entry.settings.weightBalance ? `équilibre selon « ${entry.settings.balanceAttribute} »` : 'sans équilibre' }} ·
          liste d’attente de {{ entry.settings.waitlistSize }}
          <span v-if="entry.settings.excludedReplayers?.length"> · {{ entry.settings.excludedReplayers.length }} rejoueur{{ entry.settings.excludedReplayers.length > 1 ? 's' : '' }} exclu{{ entry.settings.excludedReplayers.length > 1 ? 's' : '' }}</span>
        </p>
        <p v-for="result in entry.result.sessions" :key="result.sessionId">
          <span class="font-medium">{{ sessionName(result.sessionId) }}</span> :
          retenues {{ names(result.retained) || 'aucune' }} ;
          en attente {{ names(result.waitlisted) || 'aucune' }}
          <span class="text-gray-400">(ordre : {{ names(result.order.map((item) => item.registrationId)) || '—' }})</span>
        </p>
        <p v-if="entry.result.rejected.length">Non retenues : {{ names(entry.result.rejected) }}</p>
      </div>
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

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { REGISTRATION_PERIOD_SCOPES, REGISTRATION_REPLAY_POLICIES, REGISTRATION_SELECTION_MODES, REGISTRATION_STATUSES } from '~/utils/domain'
import { canConfirmPlace, isAnnouncementPending, isBackInPool } from '~/utils/registrations'
import { formatLongDate, formatLongDateTime } from '~/utils/dates'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'
import {
  plural,
  sendFailures,
  useRegistrationPeriodActions,
  type PeriodRegistration,
  type RegistrationPeriod
} from '~/composables/useRegistrationPeriodActions'

type Overview = ApiResponse<'/api/registration-periods/:id/selection'>
type SelectionSession = Overview['sessions'][number]
type Draw = ApiResponse<'/api/registration-periods/:id/draws'>[number]
type Decision = 'retain' | 'waitlist' | 'unwaitlist' | 'reject' | 'reset'
type MessageColor = 'success' | 'warning' | 'error'

const props = defineProps<{ period: RegistrationPeriod }>()

// Relance, nouveau lien, prolongation, libération, retrait et détail : les actions du bloc du jeu (US-005)
const { refresh, showDetail, remind, resend, askExtension, release, withdraw } = useRegistrationPeriodActions()
const registrations = computed(() => props.period.registrations)

const overview = ref<Overview | null>(null)
const message = ref('')
const messageColor = ref<MessageColor>('success')
const announcing = ref(false)

const draws = ref<Draw[]>([])
const drawing = ref(false)
const cancelling = ref(false)

function showMessage(text: string, color: MessageColor) {
  messageColor.value = color
  message.value = text
}

async function loadOverview() {
  try {
    const [selection, journal] = await Promise.all([
      useApiFetch(`/api/registration-periods/${props.period.id}/selection`),
      permanent.value ? Promise.resolve([]) : useApiFetch(`/api/registration-periods/${props.period.id}/draws`)
    ])
    overview.value = selection
    draws.value = journal
  } catch (err) {
    showMessage(apiErrorMessage(err, 'Impossible de charger la sélection'), 'error')
  }
}
// Chargée après le montage : une période créée plus tard monte ce bloc sans attente asynchrone
onMounted(loadOverview)
watch(registrations, loadOverview)

const permanent = computed(() => props.period.scope === REGISTRATION_PERIOD_SCOPES.game)
// Tirage : périodes ordinaires en mode hasard ou mixte (US-092) ; le journal reste lisible si le mode change ensuite
const drawable = computed(() => !permanent.value && props.period.selectionMode !== REGISTRATION_SELECTION_MODES.chosen)
const activeDraw = computed(() => draws.value.find((entry) => !entry.cancelledAt) || null)
const registrationNames = computed(() => new Map(registrations.value.map((registration) => [registration.id, registration.participant.name])))
const names = (ids: string[]) => ids.map((id) => registrationNames.value.get(id) || 'inscription effacée').join(', ')
const sessionName = (id: string) => props.period.sessions.find((link) => link.sessionId === id)?.session.name || 'session retirée'
const sessions = computed(() => overview.value?.sessions ?? [])
const replayers = computed(() => new Set(overview.value?.replayerParticipantIds ?? []))
const sessionIds = computed(() => new Set(sessions.value.map((session) => session.id)))
const isReplayer = (registration: PeriodRegistration) => replayers.value.has(registration.participant.id)
const pendingCount = computed(() => registrations.value.filter(isAnnouncementPending).length)
const activeCount = computed(() => registrations.value.filter((registration) => registration.status !== REGISTRATION_STATUSES.withdrawn).length)

// Une place retenue ou confirmée dans une session passée ou annulée remet la personne dans le vivier (ADR-0047)
const backInPool = (registration: PeriodRegistration) => permanent.value && isBackInPool(registration)
// En attente seulement dans des sessions passées : de nouveau à trier
const waitingNowhere = (registration: PeriodRegistration) => registration.status === REGISTRATION_STATUSES.waitlisted
  && !registration.waitlistEntries.some((entry) => sessionIds.value.has(entry.sessionId))
const excludedFromPool = (registration: PeriodRegistration) => permanent.value && overview.value?.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded && isReplayer(registration)

// Personnes retenues ou confirmées, et liste d'attente dans son ordre, par session : calculées une fois par relecture
const PLACED_STATUSES: string[] = [REGISTRATION_STATUSES.retained, REGISTRATION_STATUSES.confirmed]
const placedBySession = computed(() => {
  const placed = new Map<string, PeriodRegistration[]>()
  for (const registration of registrations.value) {
    if (!registration.sessionId || !PLACED_STATUSES.includes(registration.status)) continue
    placed.set(registration.sessionId, [...placed.get(registration.sessionId) ?? [], registration])
  }
  return placed
})
const placed = (session: SelectionSession) => placedBySession.value.get(session.id) ?? []

const waitingBySession = computed(() => {
  const entries = new Map<string, Array<{ registration: PeriodRegistration, position: number }>>()
  for (const registration of registrations.value) {
    if (registration.status !== REGISTRATION_STATUSES.waitlisted) continue
    for (const entry of registration.waitlistEntries) {
      entries.set(entry.sessionId, [...entries.get(entry.sessionId) ?? [], { registration, position: entry.position }])
    }
  }
  return new Map([...entries].map(([sessionId, list]) => [
    sessionId,
    list.sort((left, right) => left.position - right.position).map(({ registration }) => registration)
  ]))
})
const waiting = (session: SelectionSession) => waitingBySession.value.get(session.id) ?? []

const sortable = computed(() => registrations.value.filter((registration) => registration.status === REGISTRATION_STATUSES.received || backInPool(registration) || waitingNowhere(registration)))
const toSort = computed(() => sortable.value.filter((registration) => !excludedFromPool(registration)))
const outOfPool = computed(() => sortable.value.filter(excludedFromPool))
const rejected = computed(() => registrations.value.filter((registration) => registration.status === REGISTRATION_STATUSES.rejected))
const withdrawn = computed(() => registrations.value.filter((registration) => registration.status === REGISTRATION_STATUSES.withdrawn))

// Affinités (US-095, US-096) : alertes par session, personnes souhaitées, lignes à rattacher
const affinities = computed(() => overview.value?.affinities ?? { alerts: [], wishes: {}, toLink: {} })
const alertsOf = (session: SelectionSession) => affinities.value.alerts.filter((alert) => alert.sessionId === session.id)
const alertText = (alert: Overview['affinities']['alerts'][number]) => `${alert.participantName} ne veut pas ${alert.kind === 'avoid' ? 'croiser' : 'jouer avec'} ${alert.targetName}.`
const alerted = (session: SelectionSession, registration: PeriodRegistration) => alertsOf(session)
  .some((alert) => [alert.participantId, alert.targetParticipantId].includes(registration.participant.id))
const toLink = (registration: PeriodRegistration) => affinities.value.toLink[registration.id] || 0
function wishLabels(registration: PeriodRegistration, session: SelectionSession | null = null) {
  return (affinities.value.wishes[registration.id] || []).map((wish) => {
    const elsewhere = wish.sessionIds.filter((id) => id !== session?.id)
    const where = session && wish.sessionIds.includes(session.id)
      ? 'ici'
      : elsewhere.length ? elsewhere.map((id) => sessions.value.find((entry) => entry.id === id)?.name).join(', ') : 'pas encore'
    return `${wish.name} (${where})`
  })
}

// Une période à plusieurs sessions demande les disponibilités (R10) ; l'inscription permanente, non
const asksAvailability = computed(() => !permanent.value && props.period.sessions.length > 1)
function available(registration: PeriodRegistration, session: SelectionSession) {
  return !asksAvailability.value || registration.availabilities.some((availability) => availability.sessionId === session.id)
}

function availabilityLabel(registration: PeriodRegistration) {
  if (!asksAvailability.value) return ''
  return sessions.value.filter((session) => available(registration, session)).map((session) => session.name).join(', ')
}

// Mode hasard : on ne retient à la main qu'après un tirage (US-092)
const manualRetainAllowed = computed(() => !(props.period.selectionMode === REGISTRATION_SELECTION_MODES.random && !activeDraw.value))

function decisionItems(registration: PeriodRegistration): DropdownMenuItem[][] {
  const targets = sessions.value.filter((session) => available(registration, session))
  const waitingIn = new Set(registration.waitlistEntries.map((entry) => entry.sessionId))
  const retainHere = (session: SelectionSession) => registration.status === REGISTRATION_STATUSES.retained && registration.sessionId === session.id
  const groups: DropdownMenuItem[][] = [
    targets.filter((session) => manualRetainAllowed.value && !retainHere(session)).map((session) => ({
      label: `Retenir pour ${session.name}`,
      icon: 'i-heroicons-check',
      disabled: session.taken >= session.seats,
      onSelect: () => decide(registration, 'retain', session.id)
    })),
    targets.map((session) => waitingIn.has(session.id)
      ? { label: `Sortir de la liste d’attente de ${session.name}`, icon: 'i-heroicons-minus', onSelect: () => decide(registration, 'unwaitlist', session.id) }
      : { label: `Liste d’attente de ${session.name}`, icon: 'i-heroicons-queue-list', onSelect: () => decide(registration, 'waitlist', session.id) })
  ]
  const others: DropdownMenuItem[] = []
  if (!permanent.value && registration.status !== REGISTRATION_STATUSES.rejected) {
    others.push({ label: 'Non retenue', icon: 'i-heroicons-x-mark', onSelect: () => decide(registration, 'reject') })
  }
  if (registration.status !== REGISTRATION_STATUSES.received && !backInPool(registration)) {
    others.push({ label: permanent.value ? 'Remettre dans le vivier' : 'Remettre à trier', icon: 'i-heroicons-arrow-uturn-left', onSelect: () => decide(registration, 'reset') })
  }
  return [...groups, others].filter((group) => group.length)
}

// Une écriture de la sélection, puis la relecture des périodes, réussite ou échec
async function selectionWrite(send: () => Promise<unknown>, failure: string, success?: string) {
  message.value = ''
  try {
    await send()
    if (success) showMessage(success, 'success')
  } catch (err) {
    showMessage(apiErrorMessage(err, failure), 'error')
  }
  await refresh()
}

function decide(registration: PeriodRegistration, action: Decision, sessionId: string | null = null) {
  return selectionWrite(() => useApiAction(`/api/registrations/${registration.id}/selection`, { method: 'POST', body: { action, sessionId } }), 'Décision impossible')
}

function move(session: SelectionSession, index: number, offset: number) {
  const ids = waiting(session).map((registration) => registration.id)
  const [moved] = ids.splice(index, 1)
  ids.splice(index + offset, 0, moved!)
  return selectionWrite(() => useApiAction(`/api/registration-periods/${props.period.id}/waitlist`, { method: 'PUT', body: { sessionId: session.id, registrationIds: ids } }), 'Réordonnancement impossible')
}

async function draw() {
  if (!confirm('Tirer au sort les inscriptions à trier ? Le tirage range les inscriptions sans prévenir personne : vous pourrez corriger, puis annoncer.')) return
  drawing.value = true
  try {
    await selectionWrite(() => useApiAction(`/api/registration-periods/${props.period.id}/draws`, { method: 'POST' }), 'Tirage impossible', 'Tirage effectué : vérifiez le résultat, puis annoncez-le.')
  } finally {
    drawing.value = false
  }
}

async function cancelDraw(entry: Draw) {
  if (!confirm('Annuler ce tirage ? Les inscriptions dont la décision vient encore de lui repartent à trier ; il reste dans le journal.')) return
  cancelling.value = true
  try {
    await selectionWrite(() => useApiAction(`/api/registration-draws/${entry.id}/cancel`, { method: 'POST' }), 'Annulation impossible')
  } finally {
    cancelling.value = false
  }
}

async function announce() {
  if (!confirm(`Prévenir ${plural(pendingCount.value, 'personne')} par email ? Chacune reçoit un nouveau lien personnel ; l’ancien ne fonctionnera plus.`)) return
  announcing.value = true
  message.value = ''
  try {
    const result = await useApiAction(`/api/registration-periods/${props.period.id}/announce`, { method: 'POST' })
    const failures = sendFailures(result.failures)
    showMessage([
      `${plural(result.announcedCount, 'personne')} prévenue${result.announcedCount > 1 ? 's' : ''}.`,
      failures.length ? `Non prévenues : ${failures.join(', ')}. Elles restent à annoncer.` : ''
    ].filter(Boolean).join(' '), failures.length ? 'warning' : 'success')
  } catch (err) {
    showMessage(apiErrorMessage(err, 'Annonce impossible'), 'error')
  } finally {
    announcing.value = false
  }
  await refresh()
}

// Places d'une session de l'inscription permanente (R30)
const showSeats = ref(false)
const seatsTarget = ref<SelectionSession | null>(null)
const seatsValue = ref('')
const seatsError = ref('')
const savingSeats = ref(false)

function editSeats(session: SelectionSession) {
  seatsTarget.value = session
  seatsValue.value = session.defaultSeats ? '' : String(session.seats)
  seatsError.value = ''
  showSeats.value = true
}

async function saveSeats() {
  if (!seatsTarget.value) return
  savingSeats.value = true
  seatsError.value = ''
  try {
    const raw = String(seatsValue.value ?? '').trim()
    await useApiAction(`/api/registration-periods/${props.period.id}/pool-seats`, {
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
</script>
