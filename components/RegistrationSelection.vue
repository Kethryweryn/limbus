<template>
  <!-- Le vivier, session par session (SPEC-018) : ouvrir la session, caster, puis annoncer -->
  <div class="mt-4 space-y-4 border-t border-gray-100 pt-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold text-gray-700">
          Sessions · {{ pool.length }} personne{{ pool.length > 1 ? 's' : '' }} dans le vivier
        </h3>
        <p class="text-xs text-gray-500">
          Les décisions ne préviennent personne : « Annoncer le casting » envoie les emails de chaque session.
          <span v-if="overview?.replayPolicy === REGISTRATION_REPLAY_POLICIES.flagged"> Les rejoueurs sont signalés.</span>
          <span v-else-if="overview?.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded"> Les rejoueurs ne reçoivent pas de demande et n’entrent pas dans le tirage ; vous pouvez les retenir à la main.</span>
        </p>
      </div>
    </div>

    <UAlert v-if="message" :color="messageColor" variant="soft" :description="message" :close="{ color: 'neutral', variant: 'link' }" @update:open="message = ''" />

    <p v-if="overview && !sessions.length" class="text-sm text-gray-500">
      Aucune session à venir : créez une session pour la proposer au vivier.
    </p>

    <div v-for="session in sessions" :key="session.id" class="space-y-2 rounded border border-gray-100 p-3" :data-session="session.name">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-medium text-gray-800">
          {{ session.name }}<span v-if="session.date" class="text-gray-500"> · {{ formatLongDate(session.date) }}</span>
          ·
          <span :class="session.taken >= session.seats ? 'text-warning-600' : 'text-gray-600'">
            {{ session.taken }} / {{ session.seats }} place{{ session.seats > 1 ? 's' : '' }}
          </span>
          <UBadge class="ml-2" size="sm" :color="session.offered ? 'success' : 'neutral'" variant="subtle">
            {{ session.offered ? 'Ouverte à la pré-inscription' : 'Pas proposée au vivier' }}
          </UBadge>
        </h4>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="session.open"
            size="xs"
            color="neutral"
            variant="soft"
            @click="setOpen(session, false)"
          >
            Refermer
          </UButton>
          <UButton
            v-else
            size="xs"
            color="success"
            variant="soft"
            :disabled="!session.openable"
            :title="session.openable ? undefined : 'Seule une session datée et à venir peut être ouverte'"
            @click="setOpen(session, true)"
          >
            Ouvrir à la pré-inscription
          </UButton>
          <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-adjustments-horizontal" @click="editSettings(session)">
            Sélection
          </UButton>
          <!-- Tirage (R22) : un seul actif par session ; pour refaire, on annule le précédent -->
          <UButton
            v-if="session.selectionMode !== REGISTRATION_SELECTION_MODES.chosen"
            size="xs"
            icon="i-heroicons-sparkles"
            color="neutral"
            variant="soft"
            :disabled="Boolean(session.activeDrawId)"
            :title="session.activeDrawId ? 'Annulez le tirage en cours pour en refaire un' : undefined"
            :loading="drawing === session.id"
            @click="draw(session)"
          >
            Tirer au sort
          </UButton>
        </div>
      </div>

      <!-- Annonce du casting (R26) : une seule fois ; ensuite, chaque changement se propose ci-dessous (R27) -->
      <div v-if="!session.castAnnouncedAt" class="flex flex-wrap items-center gap-3 text-xs text-gray-500" data-cast-announcement>
        <UButton
          size="xs"
          color="primary"
          icon="i-heroicons-megaphone"
          :disabled="!announceCount(session)"
          :loading="announcing === session.id"
          @click="announce(session)"
        >
          Annoncer le casting{{ announceCount(session) ? ` (${announceCount(session)})` : '' }}
        </UButton>
        <UCheckbox
          v-if="waitlistedToAnnounce(session).length"
          v-model="announceWaitlist[session.id]"
          :label="`Prévenir aussi la liste d’attente (${waitlistedToAnnounce(session).length})`"
        />
      </div>
      <p v-else class="text-xs text-gray-500">Casting annoncé le {{ formatLongDate(session.castAnnouncedAt) }}.</p>

      <div v-if="session.castAnnouncedAt && proposals(session).length" class="space-y-1" data-announcement-proposals>
        <p class="text-xs font-semibold text-gray-600">Emails à envoyer : {{ proposals(session).length }}</p>
        <ul class="divide-y divide-gray-100 text-sm">
          <li v-for="{ registration, label } in proposals(session)" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span><span class="font-medium text-gray-800">{{ registration.participant.name }}</span> · {{ label }}</span>
            <div class="flex shrink-0 flex-wrap gap-2">
              <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-envelope" :loading="answeringProposal === registration.id" @click="answerProposal(registration, session, 'send')">Envoyer l’email</UButton>
              <UButton size="xs" color="neutral" variant="ghost" :disabled="answeringProposal === registration.id" @click="answerProposal(registration, session, 'ignore')">Ignorer</UButton>
            </div>
          </li>
        </ul>
      </div>

      <!-- Demande de disponibilités (R9, R12) : rien ne part sans ce clic -->
      <div v-if="session.offered" class="flex flex-wrap items-center gap-2 text-xs text-gray-500" data-availability-request>
        <span>{{ requestSummary(session) }}</span>
        <UButton
          size="xs"
          color="primary"
          variant="soft"
          icon="i-heroicons-envelope"
          :disabled="!session.askableCount"
          :loading="asking === session.id"
          @click="askPool(session)"
        >
          {{ session.lastRequestedAt ? 'Relancer' : 'Demander au vivier' }}{{ session.askableCount ? ` (${session.askableCount})` : '' }}
        </UButton>
      </div>
      <UAlert
        v-if="justOpened === session.id && session.offered && session.askableCount && !session.lastRequestedAt"
        color="info"
        variant="soft"
        title="Session ouverte"
        :description="`Écrire au vivier pour demander qui est disponible ? La demande partirait à ${plural(session.askableCount, 'personne')}. Rien ne part sans votre clic.`"
        :actions="[{ label: 'Envoyer la demande', color: 'primary', onClick: () => askPool(session) }, { label: 'Plus tard', color: 'neutral', variant: 'ghost', onClick: () => { justOpened = null } }]"
      />
      <UAlert
        v-if="askFailures[session.id]?.length"
        color="warning"
        variant="soft"
        title="Demande non envoyée"
        :description="sendFailures(askFailures[session.id]!).join(', ')"
        :actions="[{ label: 'Réessayer', color: 'primary', onClick: () => askPool(session, askFailures[session.id]!.map((failure) => failure.registrationId)) }]"
      />

      <p v-if="session.selectionMode !== REGISTRATION_SELECTION_MODES.chosen && !session.activeDrawId" class="text-xs text-gray-500">
        <template v-if="session.selectionMode === REGISTRATION_SELECTION_MODES.mixed">
          Mode mixte : avant le tirage, chaque organisatrice retient jusqu’à {{ session.organizerPicks ?? 0 }} personne{{ (session.organizerPicks ?? 0) > 1 ? 's' : '' }} ; le tirage remplit le reste.
        </template>
        <template v-else>Sélection au hasard : lancez le tirage, puis corrigez à la main si besoin.</template>
      </p>

      <UAlert
        v-if="session.taken > session.seats"
        color="warning"
        variant="soft"
        :description="`Cette session est en surnombre : ${session.taken} personnes pour ${session.seats} personnages PJ.`"
      />

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
          <RegistrationSelectionName :registration="registration" :line="lineOf(registration, session)" :replayer="isReplayer(registration)" :alert="alerted(session, registration)" :wishes="wishLabels(registration, session)" :to-link="toLink(registration)" />
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">Détail</UButton>
            <UButton v-if="lineOf(registration, session)?.answersChangedAt" size="xs" color="warning" variant="soft" icon="i-heroicons-check" @click="markAnswersRead(registration, session)">Marquer comme lu</UButton>
            <template v-if="lineOf(registration, session)?.status === LINE.retained">
              <template v-if="canConfirmPlace(lineOf(registration, session)!)">
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-bell-alert" @click="remind(registration, session.id)">Relancer</UButton>
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-arrow-path" @click="resend(registration, session.id)">Nouveau lien</UButton>
                <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-calendar-days" @click="askExtension(registration, session.id)">Prolonger</UButton>
                <UButton size="xs" color="warning" variant="soft" icon="i-heroicons-user-minus" @click="release(registration, session.id)">Libérer</UButton>
              </template>
              <UDropdownMenu :items="placedItems(registration, session)">
                <UButton size="xs" color="neutral" variant="soft" trailing-icon="i-heroicons-chevron-down">Changer</UButton>
              </UDropdownMenu>
            </template>
            <UButton
              v-else
              size="xs"
              color="error"
              variant="soft"
              icon="i-heroicons-user-minus"
              @click="withdraw(registration, session.id)"
            >
              Retirer
            </UButton>
          </div>
        </li>
      </ul>

      <div v-if="waiting(session).length" class="space-y-1">
        <p class="text-xs font-semibold text-gray-600">Liste d’attente</p>
        <!-- Une place libre propose la première personne de la file (R23) : l'équipe la retient, puis l'annonce -->
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
              <RegistrationSelectionName :registration="registration" :line="lineOf(registration, session)" :replayer="isReplayer(registration)" :wishes="wishLabels(registration, session)" :to-link="toLink(registration)" />
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-up" :disabled="index === 0" aria-label="Monter" @click="move(session, index, -1)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-down" :disabled="index === waiting(session).length - 1" aria-label="Descendre" @click="move(session, index, 1)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">Détail</UButton>
              <UButton size="xs" color="primary" variant="soft" :disabled="session.taken >= session.seats" @click="decide(registration, 'retain', session.id)">Retenir</UButton>
              <UButton size="xs" color="neutral" variant="soft" @click="decide(registration, 'unwaitlist', session.id)">Sortir de la liste</UButton>
            </div>
          </li>
        </ol>
      </div>

      <div v-if="preregistered(session).length" class="space-y-1">
        <p class="text-xs font-semibold text-gray-600">Pré-inscrites : {{ preregistered(session).length }}</p>
        <ul class="divide-y divide-gray-100 text-sm">
          <li v-for="registration in preregistered(session)" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
            <RegistrationSelectionName :registration="registration" :line="lineOf(registration, session)" :replayer="isReplayer(registration)" :wishes="wishLabels(registration, session)" :to-link="toLink(registration)" />
            <div class="flex shrink-0 flex-wrap gap-2">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">Détail</UButton>
              <UButton
                v-if="manualRetainAllowed(session)"
                size="xs"
                color="primary"
                variant="soft"
                :disabled="session.taken >= session.seats"
                :title="session.taken >= session.seats ? 'Session complète : créez un personnage pour ajouter une place' : undefined"
                @click="decide(registration, 'retain', session.id)"
              >
                Retenir
              </UButton>
              <UButton size="xs" color="neutral" variant="soft" @click="decide(registration, 'waitlist', session.id)">Liste d’attente</UButton>
            </div>
          </li>
        </ul>
      </div>

      <p v-if="!placed(session).length && !waiting(session).length && !preregistered(session).length" class="text-xs text-gray-500">Personne pour l’instant.</p>

      <!-- Ajout à la main d'une autre personne du vivier (R20) : un refus ou un rejoueur exclu se signale -->
      <div v-if="others(session).length && manualRetainAllowed(session)" class="flex flex-wrap items-center gap-2 pt-1">
        <USelectMenu
          size="xs"
          class="w-72"
          :items="otherItems(session)"
          value-key="value"
          placeholder="Ajouter une autre personne du vivier…"
          :disabled="session.taken >= session.seats"
          @update:model-value="(id) => id && decide(registrationById(id), 'retain', session.id)"
        />
      </div>
    </div>

    <div class="space-y-1">
      <p class="text-xs font-semibold text-gray-600">Dans le vivier : {{ pool.length }}</p>
      <ul v-if="pool.length" class="divide-y divide-gray-100 text-sm">
        <li v-for="registration in pool" :key="registration.id" class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
          <RegistrationSelectionName :registration="registration" :replayer="isReplayer(registration)" :wishes="wishLabels(registration)" :to-link="toLink(registration)" :summary="lineSummary(registration)" />
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">Détail</UButton>
            <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-arrow-path" @click="resend(registration)">Nouveau lien</UButton>
            <UButton size="xs" color="error" variant="soft" icon="i-heroicons-user-minus" @click="withdraw(registration)">Retirer du vivier</UButton>
          </div>
        </li>
      </ul>
      <p v-else class="text-xs text-gray-500">Personne pour l’instant : partagez le lien de diffusion.</p>
    </div>

    <!-- Journal des tirages (US-094) : graine, réglages et résultat de chacun, annulés compris -->
    <div v-if="draws.length" class="space-y-2">
      <p class="text-xs font-semibold text-gray-600">Tirages</p>
      <div v-for="entry in draws" :key="entry.id" class="space-y-1 rounded border border-gray-100 p-2 text-xs text-gray-600">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span class="font-medium">{{ entry.session?.name || 'Ancienne période' }}</span>,
            le {{ formatLongDateTime(entry.createdAt) }}<span v-if="entry.createdBy"> par {{ entry.createdBy.name }}</span>
            · graine <code>{{ entry.seed }}</code>
            <UBadge v-if="entry.cancelledAt" class="ml-1" size="sm" color="neutral" variant="outline">
              Annulé le {{ formatLongDateTime(entry.cancelledAt) }}<span v-if="entry.cancelledBy">&nbsp;par {{ entry.cancelledBy.name }}</span>
            </UBadge>
          </span>
          <UButton v-if="!entry.cancelledAt && entry.sessionId" size="xs" color="warning" variant="soft" :loading="cancelling" @click="cancelDraw(entry)">
            Annuler ce tirage
          </UButton>
        </div>
        <p>
          {{ entry.settings.weightNotDrawnBefore ? 'Chances doublées pour les personnes restées sans place' : 'Sans priorité' }} ·
          {{ entry.settings.weightBalance ? `équilibre selon « ${entry.settings.balanceAttribute} »` : 'sans équilibre' }} ·
          liste d’attente de {{ entry.settings.waitlistSize }}
          <span v-if="entry.settings.excludedReplayers?.length"> · {{ entry.settings.excludedReplayers.length }} rejoueur{{ entry.settings.excludedReplayers.length > 1 ? 's' : '' }} exclu{{ entry.settings.excludedReplayers.length > 1 ? 's' : '' }}</span>
        </p>
        <p v-for="result in entry.result.sessions" :key="result.sessionId">
          retenues {{ names(result.retained) || 'aucune' }} ;
          en attente {{ names(result.waitlisted) || 'aucune' }}
          <span class="text-gray-400">(ordre : {{ names(result.order.map((item) => item.registrationId)) || '—' }})</span>
        </p>
        <p v-if="entry.result.rejected.length">Restées pré-inscrites : {{ names(entry.result.rejected) }}</p>
      </div>
    </div>

    <div v-if="left.length" class="space-y-1">
      <p class="text-xs font-semibold text-gray-600">Sorties du vivier : {{ left.length }}</p>
      <ul class="text-sm text-gray-600">
        <li v-for="registration in left" :key="registration.id">{{ registration.participant.name }}</li>
      </ul>
    </div>

    <!-- Sélection d'une session (R22) -->
    <UModal v-model:open="showSettings" :title="settingsTarget ? `Sélection de ${settingsTarget.name}` : 'Sélection'">
      <template #body>
        <form class="space-y-4" novalidate @submit.prevent="saveSettings">
          <UFormField label="Mode de sélection">
            <USelect v-model="settings.selectionMode" :items="SELECTION_MODE_ITEMS" value-key="value" class="w-full" />
          </UFormField>
          <UFormField
            v-if="settings.selectionMode === REGISTRATION_SELECTION_MODES.mixed"
            label="Places choisies par organisatrice"
            description="Avant le tirage."
          >
            <UInput v-model.number="settings.organizerPicks" type="number" min="0" max="1000" class="w-full sm:w-40" />
          </UFormField>
          <template v-if="settings.selectionMode !== REGISTRATION_SELECTION_MODES.chosen">
            <AppCheckboxRow
              v-model="settings.weightNotDrawnBefore"
              label="Priorité aux personnes restées sans place"
              description="Chances doublées pour qui est resté sans place lors d’un tirage d’une session plus ancienne du jeu."
            />
            <AppCheckboxRow
              v-model="settings.weightBalance"
              label="Équilibre selon l’attribut des personnages"
              description="Places réservées par valeur (par exemple le genre du personnage), au prorata des PJ, selon la question d’équilibre du formulaire."
            />
            <UFormField label="Liste d’attente après le tirage" description="Les personnes au-delà restent pré-inscrites, sans message.">
              <UInput v-model.number="settings.waitlistSize" type="number" min="0" max="1000" class="w-full sm:w-40" />
            </UFormField>
          </template>
          <UAlert v-if="settingsError" color="error" variant="soft" :description="settingsError" />
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="showSettings = false">Annuler</UButton>
            <UButton type="submit" color="primary" :loading="savingSettings">Enregistrer</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  REGISTRATION_DEFAULT_WAITLIST_SIZE,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SEAT_STATUSES,
  REGISTRATION_SELECTION_MODE_OPTIONS,
  REGISTRATION_SELECTION_MODES,
  REGISTRATION_SESSION_STATUSES as LINE,
  REGISTRATION_SESSION_STATUS_META,
  REGISTRATION_STATUSES,
  metaOf
} from '~/utils/domain'
import { ANNOUNCEMENT_REMOVED, canConfirmPlace, pendingAnnouncement } from '~/utils/registrations'
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
type Decision = 'retain' | 'waitlist' | 'unwaitlist' | 'reset'
type MessageColor = 'success' | 'warning' | 'error'
// Un champ nombre vidé rend une chaîne vide : la validation le refuse
type Count = number | ''

const SELECTION_MODE_ITEMS: Array<{ value: string, label: string }> = [...REGISTRATION_SELECTION_MODE_OPTIONS]

const props = defineProps<{ period: RegistrationPeriod }>()

// Relance, nouveau lien, prolongation, libération, retrait et détail : les actions du bloc du jeu (US-005)
const { refresh, showDetail, remind, resend, askExtension, release, withdraw } = useRegistrationPeriodActions()
const registrations = computed(() => props.period.registrations)

const overview = ref<Overview | null>(null)
const message = ref('')
const messageColor = ref<MessageColor>('success')
const announcing = ref<string | null>(null)
const announceWaitlist = ref<Record<string, boolean>>({})
const answeringProposal = ref<string | null>(null)

const draws = ref<Draw[]>([])
const drawing = ref<string | null>(null)
const cancelling = ref(false)

function showMessage(text: string, color: MessageColor) {
  messageColor.value = color
  message.value = text
}

// Lisible hors ligne depuis sa dernière version sur l'appareil (US-119)
async function loadOverview() {
  try {
    const [selection, journal] = await Promise.all([
      useApiFetch(`/api/registration-periods/${props.period.id}/selection`, { offlineCache: true }),
      useApiFetch(`/api/registration-periods/${props.period.id}/draws`, { offlineCache: true })
    ])
    overview.value = selection
    draws.value = journal
  } catch (err) {
    showMessage(apiErrorMessage(err, 'Impossible de charger la sélection'), 'error')
  }
}
// Chargée après le montage : un vivier créé plus tard monte ce bloc sans attente asynchrone
onMounted(loadOverview)
watch(registrations, loadOverview)

const sessions = computed(() => overview.value?.sessions ?? [])
const replayers = computed(() => new Set(overview.value?.replayerParticipantIds ?? []))
const isReplayer = (registration: PeriodRegistration) => replayers.value.has(registration.participant.id)
const registrationNames = computed(() => new Map(registrations.value.map((registration) => [registration.id, registration.participant.name])))
const names = (ids: string[]) => ids.map((id) => registrationNames.value.get(id) || 'inscription effacée').join(', ')
const registrationById = (id: string) => registrations.value.find((registration) => registration.id === id)!

// Les personnes du vivier, et celles qui en sont sorties ; une invitation sans réponse n'y est pas encore (R4)
const pool = computed(() => registrations.value.filter((registration) => registration.status === REGISTRATION_STATUSES.received))
const left = computed(() => registrations.value.filter((registration) => registration.status === REGISTRATION_STATUSES.withdrawn))

const lineOf = (registration: PeriodRegistration, session: SelectionSession) => registration.sessionLines.find((line) => line.sessionId === session.id)
const statusIn = (session: SelectionSession, statuses: string[]) => pool.value.filter((registration) => statuses.includes(lineOf(registration, session)?.status ?? ''))
const placed = (session: SelectionSession) => statusIn(session, REGISTRATION_SEAT_STATUSES)
const preregistered = (session: SelectionSession) => statusIn(session, [LINE.preregistered])
const waiting = (session: SelectionSession) => statusIn(session, [LINE.waitlisted])
  .sort((left, right) => (lineOf(left, session)?.waitlistPosition ?? 0) - (lineOf(right, session)?.waitlistPosition ?? 0))
// Autres personnes du vivier : sans réponse, pas disponibles, ou annulées pour cette session
const others = (session: SelectionSession) => pool.value.filter((registration) => {
  const status = lineOf(registration, session)?.status
  return !status || status === LINE.unavailable || status === LINE.cancelled
})

function otherItems(session: SelectionSession) {
  const excluded = overview.value?.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded
  return others(session).map((registration) => {
    const status = lineOf(registration, session)?.status
    const notes = [
      status === LINE.unavailable ? 'a répondu « pas disponible »' : '',
      status === LINE.cancelled ? 'a annulé' : '',
      excluded && isReplayer(registration) ? 'rejoueur exclu' : ''
    ].filter(Boolean)
    return { label: notes.length ? `${registration.participant.name} (${notes.join(', ')})` : registration.participant.name, value: registration.id }
  })
}

// Sa situation, session par session
function lineSummary(registration: PeriodRegistration) {
  return registration.sessionLines
    .map((line) => {
      const session = sessions.value.find((candidate) => candidate.id === line.sessionId)
      const label = metaOf(REGISTRATION_SESSION_STATUS_META, line.status)?.label
      return session && label ? `${session.name} : ${label.toLowerCase()}` : ''
    })
    .filter(Boolean)
    .join(' · ')
}

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

// Mode hasard : on ne retient à la main qu'après un tirage (US-092)
const manualRetainAllowed = (session: SelectionSession) => !(session.selectionMode === REGISTRATION_SELECTION_MODES.random && !session.activeDrawId)

function placedItems(registration: PeriodRegistration, session: SelectionSession): DropdownMenuItem[][] {
  return [[
    { label: 'Liste d’attente', icon: 'i-heroicons-queue-list', onSelect: () => decide(registration, 'waitlist', session.id) },
    { label: 'Retirer du cast', icon: 'i-heroicons-arrow-uturn-left', onSelect: () => decide(registration, 'reset', session.id) }
  ]]
}

// Une écriture de la sélection, puis la relecture du vivier, réussite ou échec
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

function decide(registration: PeriodRegistration, action: Decision, sessionId: string) {
  return selectionWrite(() => useApiAction(`/api/registrations/${registration.id}/selection`, { method: 'POST', body: { action, sessionId } }), 'Décision impossible')
}

function move(session: SelectionSession, index: number, offset: number) {
  const ids = waiting(session).map((registration) => registration.id)
  const [moved] = ids.splice(index, 1)
  ids.splice(index + offset, 0, moved!)
  return selectionWrite(() => useApiAction(`/api/registration-periods/${props.period.id}/waitlist`, { method: 'PUT', body: { sessionId: session.id, registrationIds: ids } }), 'Réordonnancement impossible')
}

// Après l'ouverture, la demande est proposée, sans rien envoyer (R9)
const justOpened = ref<string | null>(null)
const asking = ref<string | null>(null)
const askFailures = ref<Record<string, Array<{ registrationId: string, participantName: string, message: string | null }>>>({})

function requestSummary(session: SelectionSession) {
  const waiting = `${plural(session.askableCount, 'personne')} sans réponse`
  return session.lastRequestedAt
    ? `Dernière demande le ${formatLongDate(session.lastRequestedAt)} · ${plural(session.answeredCount, 'réponse')} · ${waiting}`
    : `Pas encore de demande · ${waiting}`
}

// Écrit aux personnes sans réponse ; `registrationIds` : seulement celles pour qui l'envoi a échoué
async function askPool(session: SelectionSession, registrationIds?: string[]) {
  const count = registrationIds?.length ?? session.askableCount
  const verb = session.lastRequestedAt ? 'Relancer' : 'Demander à'
  if (!confirm(`${verb} ${plural(count, 'personne')} par email pour « ${session.name} » ?`)) return
  asking.value = session.id
  message.value = ''
  try {
    const result = await useApiAction(`/api/registration-periods/${props.period.id}/sessions/${session.id}/availability-request`, { method: 'POST', body: { registrationIds } })
    askFailures.value = { ...askFailures.value, [session.id]: result.failures }
    justOpened.value = null
    showMessage(`${plural(result.sentCount, 'email')} envoyé${result.sentCount > 1 ? 's' : ''}.`, result.failures.length ? 'warning' : 'success')
    await loadOverview()
  } catch (err) {
    showMessage(apiErrorMessage(err, 'Demande impossible'), 'error')
  } finally {
    asking.value = null
  }
}

function setOpen(session: SelectionSession, open: boolean) {
  justOpened.value = open ? session.id : null
  return selectionWrite(() => useApiAction(`/api/registration-periods/${props.period.id}/sessions/${session.id}`, { method: 'PUT', body: { open } }), 'Modification impossible')
}

async function draw(session: SelectionSession) {
  if (!confirm(`Tirer au sort les pré-inscrites de « ${session.name} » ? Le tirage range les personnes sans prévenir personne : vous pourrez corriger, puis annoncer.`)) return
  drawing.value = session.id
  try {
    await selectionWrite(() => useApiAction(`/api/registration-periods/${props.period.id}/draws`, { method: 'POST', body: { sessionId: session.id } }), 'Tirage impossible', 'Tirage effectué : vérifiez le résultat, puis annoncez-le.')
  } finally {
    drawing.value = null
  }
}

async function cancelDraw(entry: Draw) {
  if (!confirm('Annuler ce tirage ? Les personnes dont la décision vient encore de lui repartent pré-inscrites ; il reste dans le journal.')) return
  cancelling.value = true
  try {
    await selectionWrite(() => useApiAction(`/api/registration-draws/${entry.id}/cancel`, { method: 'POST' }), 'Annulation impossible')
  } finally {
    cancelling.value = false
  }
}

const linesToAnnounce = (session: SelectionSession, status: string) => pool.value.filter((registration) => {
  const line = lineOf(registration, session)
  return line && pendingAnnouncement(line) === status
})
const retainedToAnnounce = (session: SelectionSession) => linesToAnnounce(session, LINE.retained)
const waitlistedToAnnounce = (session: SelectionSession) => linesToAnnounce(session, LINE.waitlisted)

const announceCount = (session: SelectionSession) => retainedToAnnounce(session).length + (announceWaitlist.value[session.id] ? waitlistedToAnnounce(session).length : 0)

const PROPOSAL_LABELS: Record<string, string> = {
  [LINE.retained]: 'retenue depuis l’annonce',
  [LINE.waitlisted]: 'passée en liste d’attente depuis l’annonce',
  [ANNOUNCEMENT_REMOVED]: 'n’a plus ce qui lui a été annoncé'
}

// Après l'annonce, ce qui a changé pour une personne : l'équipe lui écrit, ou écarte l'email (R27)
function proposals(session: SelectionSession) {
  return pool.value.flatMap((registration) => {
    const line = lineOf(registration, session)
    const pending = line && pendingAnnouncement(line)
    return pending ? [{ registration, label: PROPOSAL_LABELS[pending]! }] : []
  })
}

async function announce(session: SelectionSession) {
  const includeWaitlist = Boolean(announceWaitlist.value[session.id])
  if (!confirm(`Annoncer le casting de « ${session.name} » à ${plural(announceCount(session), 'personne')} par email ? Ensuite, chaque changement se proposera personne par personne.`)) return
  announcing.value = session.id
  message.value = ''
  try {
    const result = await useApiAction(`/api/registration-periods/${props.period.id}/sessions/${session.id}/announce`, { method: 'POST', body: { includeWaitlist } })
    const failures = sendFailures(result.failures)
    showMessage([
      `${plural(result.announcedCount, 'personne')} prévenue${result.announcedCount > 1 ? 's' : ''}.`,
      failures.length ? `Non prévenues : ${failures.join(', ')}. Elles restent à prévenir.` : ''
    ].filter(Boolean).join(' '), failures.length ? 'warning' : 'success')
  } catch (err) {
    showMessage(apiErrorMessage(err, 'Annonce impossible'), 'error')
  } finally {
    announcing.value = null
  }
  await refresh()
}

// Le repère disparaît pour toute l'équipe (R16)
function markAnswersRead(registration: PeriodRegistration, session: SelectionSession) {
  return selectionWrite(() => useApiAction(`/api/registrations/${registration.id}/answers-read`, { method: 'POST', body: { sessionId: session.id } }), 'Impossible de marquer comme lu')
}

async function answerProposal(registration: PeriodRegistration, session: SelectionSession, action: 'send' | 'ignore') {
  answeringProposal.value = registration.id
  await selectionWrite(
    () => useApiAction(`/api/registrations/${registration.id}/announcement`, { method: 'POST', body: { action, sessionId: session.id } }),
    'Email impossible',
    action === 'send' ? `Email envoyé à ${registration.participant.name}.` : undefined
  )
  answeringProposal.value = null
}

// Sélection d'une session (R22)
const showSettings = ref(false)
const settingsTarget = ref<SelectionSession | null>(null)
const settingsError = ref('')
const savingSettings = ref(false)
const settings = ref({
  selectionMode: REGISTRATION_SELECTION_MODES.chosen as string,
  organizerPicks: 0 as Count,
  weightNotDrawnBefore: false,
  weightBalance: false,
  waitlistSize: REGISTRATION_DEFAULT_WAITLIST_SIZE as Count
})

function editSettings(session: SelectionSession) {
  settingsTarget.value = session
  settingsError.value = ''
  settings.value = {
    selectionMode: session.selectionMode,
    organizerPicks: session.organizerPicks ?? 0,
    weightNotDrawnBefore: session.weightNotDrawnBefore,
    weightBalance: session.weightBalance,
    waitlistSize: session.waitlistSize
  }
  showSettings.value = true
}

const isCount = (value: Count) => value !== '' && Number.isInteger(value) && value >= 0 && value <= 1000

async function saveSettings() {
  if (!settingsTarget.value) return
  const { selectionMode, organizerPicks, waitlistSize, ...weights } = settings.value
  const mixed = selectionMode === REGISTRATION_SELECTION_MODES.mixed
  if ((mixed && !isCount(organizerPicks)) || !isCount(waitlistSize)) {
    settingsError.value = 'Indiquez un nombre entre 0 et 1000.'
    return
  }
  savingSettings.value = true
  settingsError.value = ''
  try {
    await useApiAction(`/api/registration-periods/${props.period.id}/sessions/${settingsTarget.value.id}`, {
      method: 'PUT',
      body: { selectionMode, organizerPicks: mixed ? Number(organizerPicks) : null, waitlistSize: Number(waitlistSize), ...weights }
    })
    showSettings.value = false
    await loadOverview()
  } catch (err) {
    settingsError.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    savingSettings.value = false
  }
}
</script>
