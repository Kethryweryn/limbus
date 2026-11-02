<template>
  <!-- Une inscription dans l'écran de sélection : nom, statut, décision à annoncer, rejoueur, affinités (US-087, US-088, US-096) -->
  <div class="min-w-0">
    <span class="font-medium text-gray-800">{{ registration.participant.name }}</span>
    <UBadge class="ml-2" size="sm" :color="statusMeta.color" variant="subtle">{{ statusMeta.label }}</UBadge>
    <UBadge v-if="pending" class="ml-1" size="sm" color="warning" variant="outline">À annoncer</UBadge>
    <UBadge v-if="replayer" class="ml-1" size="sm" color="neutral" variant="outline">A déjà joué</UBadge>
    <!-- Affinités (US-095, US-096) : alerte de la session, lignes à rattacher -->
    <UBadge v-if="alert" class="ml-1" size="sm" color="error" variant="subtle" icon="i-heroicons-exclamation-triangle">Alerte</UBadge>
    <UBadge v-if="toLink" class="ml-1" size="sm" color="warning" variant="outline">
      {{ toLink }} affinité{{ toLink > 1 ? 's' : '' }} à rattacher
    </UBadge>
    <div class="text-xs text-gray-500">
      {{ registration.email }}
      <span v-if="registration.confirmedAt"> · confirmée le {{ formatLongDate(registration.confirmedAt) }}</span>
      <span v-else-if="registration.status === REGISTRATION_STATUSES.retained && registration.responseDueAt"> · confirmation avant le {{ formatLongDate(registration.responseDueAt) }}</span>
      <span v-if="registration.lastRemindedAt"> · relancée le {{ formatLongDate(registration.lastRemindedAt) }}</span>
      <span v-if="availability"> · disponible : {{ availability }}</span>
    </div>
    <p v-if="wishes.length" class="text-xs text-gray-500">Veut jouer avec {{ wishes.join(', ') }}</p>
    <p v-if="registration.missingFromSession" class="text-xs text-warning-600">
      N’est plus participante de la session (retirée depuis l’écran de session).
    </p>
  </div>
</template>

<script setup lang="ts">
import { REGISTRATION_STATUSES } from '~/utils/domain'
import { isAnnouncementPending, registrationStatusMeta } from '~/utils/registrations'
import { formatLongDate } from '~/utils/dates'
import type { PeriodRegistration } from '~/composables/useRegistrationPeriodActions'

const props = withDefaults(defineProps<{
  registration: PeriodRegistration
  replayer?: boolean
  availability?: string
  alert?: boolean
  toLink?: number
  // « Max (ici) », « Zoé (Session 2) », « Noé (pas encore) »
  wishes?: string[]
}>(), { replayer: false, availability: '', alert: false, toLink: 0, wishes: () => [] })

const statusMeta = computed(() => registrationStatusMeta(props.registration))
const pending = computed(() => isAnnouncementPending(props.registration))
</script>
