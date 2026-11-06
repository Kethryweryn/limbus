<template>
  <!-- Une personne dans l'écran de sélection : nom, statut pour la session, décision à annoncer, rejoueur, affinités (US-087, US-088, US-096) -->
  <div class="min-w-0">
    <span class="font-medium text-gray-800">{{ registration.participant.name }}</span>
    <UBadge v-if="line" class="ml-2" size="sm" :color="statusMeta.color" variant="subtle">{{ statusMeta.label }}</UBadge>
    <UBadge v-if="line && pending" class="ml-1" size="sm" color="warning" variant="outline">À annoncer</UBadge>
    <UBadge v-if="line?.answersChangedAt" class="ml-1" size="sm" color="warning" variant="subtle" icon="i-heroicons-pencil-square">Réponses modifiées</UBadge>
    <UBadge v-if="line && line.answer === REGISTRATION_ANSWERS.unavailable && line.status !== REGISTRATION_SESSION_STATUSES.unavailable" class="ml-1" size="sm" color="warning" variant="outline">A répondu « pas disponible »</UBadge>
    <UBadge v-if="replayer" class="ml-1" size="sm" color="neutral" variant="outline">A déjà joué</UBadge>
    <!-- Affinités (US-095, US-096) : alerte de la session, lignes à rattacher -->
    <UBadge v-if="alert" class="ml-1" size="sm" color="error" variant="subtle" icon="i-heroicons-exclamation-triangle">Alerte</UBadge>
    <UBadge v-if="toLink" class="ml-1" size="sm" color="warning" variant="outline">
      {{ toLink }} affinité{{ toLink > 1 ? 's' : '' }} à rattacher
    </UBadge>
    <div class="text-xs text-gray-500">
      {{ registration.email }}
      <template v-if="line">
        <span v-if="line.confirmedAt"> · confirmée le {{ formatLongDate(line.confirmedAt) }}</span>
        <span v-else-if="line.status === REGISTRATION_SESSION_STATUSES.retained && line.responseDueAt"> · confirmation avant le {{ formatLongDate(line.responseDueAt) }}</span>
        <span v-if="line.lastRemindedAt"> · relancée le {{ formatLongDate(line.lastRemindedAt) }}</span>
      </template>
      <span v-if="summary"> · {{ summary }}</span>
    </div>
    <p v-if="wishes.length" class="text-xs text-gray-500">Veut jouer avec {{ wishes.join(', ') }}</p>
    <p v-if="line?.missingFromSession" class="text-xs text-warning-600">
      N’est plus participante de la session (retirée depuis l’écran de session).
    </p>
  </div>
</template>

<script setup lang="ts">
import { REGISTRATION_ANSWERS, REGISTRATION_SESSION_STATUSES } from '~/utils/domain'
import { isAnnouncementPending, registrationStatusMeta } from '~/utils/registrations'
import { formatLongDate } from '~/utils/dates'
import type { PeriodRegistration } from '~/composables/useRegistrationPeriodActions'

const props = withDefaults(defineProps<{
  registration: PeriodRegistration
  // Sa ligne pour la session affichée ; absente dans la liste du vivier
  line?: PeriodRegistration['sessionLines'][number]
  replayer?: boolean
  // Sa situation dans les sessions, pour la liste du vivier
  summary?: string
  alert?: boolean
  toLink?: number
  // « Max (ici) », « Zoé (Session 2) », « Noé (pas encore) »
  wishes?: string[]
}>(), { line: undefined, replayer: false, summary: '', alert: false, toLink: 0, wishes: () => [] })

const statusMeta = computed(() => props.line ? registrationStatusMeta(props.line) : { label: '', color: 'neutral' as const })
const pending = computed(() => Boolean(props.line) && isAnnouncementPending(props.line!))
</script>
