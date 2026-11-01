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
      <span v-if="registration.confirmedAt"> · confirmée le {{ formatDate(registration.confirmedAt) }}</span>
      <span v-else-if="registration.status === REGISTRATION_STATUSES.retained && registration.responseDueAt"> · confirmation avant le {{ formatDate(registration.responseDueAt) }}</span>
      <span v-if="registration.lastRemindedAt"> · relancée le {{ formatDate(registration.lastRemindedAt) }}</span>
      <span v-if="availability"> · disponible : {{ availability }}</span>
    </div>
    <p v-if="wishes.length" class="text-xs text-gray-500">Veut jouer avec {{ wishes.join(', ') }}</p>
    <p v-if="registration.missingFromSession" class="text-xs text-warning-600">
      N’est plus participante de la session (retirée depuis l’écran de session).
    </p>
  </div>
</template>

<script setup>
import { REGISTRATION_STATUSES } from '~/utils/domain'
import { REGISTRATION_DISPLAY_STATUS_META, isAnnouncementPending, registrationDisplayStatus } from '~/utils/registrations'

const props = defineProps({
  registration: { type: Object, required: true },
  replayer: { type: Boolean, default: false },
  availability: { type: String, default: '' },
  alert: { type: Boolean, default: false },
  toLink: { type: Number, default: 0 },
  // « Max (ici) », « Zoé (Session 2) », « Noé (pas encore) »
  wishes: { type: Array, default: () => [] }
})

// « Délai dépassé » se lit sur l'échéance (R20, ADR-0020)
const statusMeta = computed(() => REGISTRATION_DISPLAY_STATUS_META[registrationDisplayStatus(props.registration)]
  || { label: props.registration.status, color: 'neutral' })
const pending = computed(() => isAnnouncementPending(props.registration))

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long' })
</script>
