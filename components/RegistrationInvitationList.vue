<template>
  <!-- Invitations à rejoindre le vivier (R4) : une personne invitée n'y est qu'une fois qu'elle a répondu -->
  <div class="mt-4 space-y-2 border-t border-gray-100 pt-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-gray-700">Invitations sans réponse : {{ filtering ? `${invitations.length} sur ${allInvitations.length}` : invitations.length }}</h3>
      <UButton
        size="xs"
        icon="i-heroicons-envelope"
        color="primary"
        variant="soft"
        :disabled="!open"
        :title="open ? undefined : 'Ouvrez le vivier pour inviter'"
        @click="invite(period)"
      >
        Inviter
      </UButton>
    </div>
    <ul v-if="invitations.length" class="divide-y divide-gray-100 text-sm">
      <li
        v-for="registration in invitations"
        :key="registration.id"
        class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0">
          <span class="font-medium text-gray-800">{{ registration.participant.name }}</span>
          <UBadge class="ml-2" size="sm" :color="registrationStatusMeta(registration).color" variant="subtle">{{ registrationStatusMeta(registration).label }}</UBadge>
          <div class="text-xs text-gray-500">
            {{ registration.email }}
            <span v-if="sessionLabel(registration)"> · pour {{ sessionLabel(registration) }}</span>
            <span v-if="registration.invitationSentAt"> · invitée le {{ formatLongDate(registration.invitationSentAt) }}</span>
            <span v-else class="text-warning-600"> · email non envoyé</span>
            <span v-if="registration.lastRemindedAt"> · relancée le {{ formatLongDate(registration.lastRemindedAt) }}</span>
            <span v-if="registration.responseDueAt"> · réponse avant le {{ formatLongDate(registration.responseDueAt) }}</span>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <UButton
            v-if="registration.invitationSentAt"
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-heroicons-bell-alert"
            @click="remind(registration)"
          >
            Relancer
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-heroicons-arrow-path"
            :title="registration.invitationSentAt ? 'Pour une personne qui a perdu son email d’invitation' : undefined"
            @click="resend(registration)"
          >
            {{ registration.invitationSentAt ? 'Nouveau lien' : 'Envoyer' }}
          </UButton>
          <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-calendar-days" @click="askExtension(registration)">
            Prolonger
          </UButton>
          <UButton size="xs" color="warning" variant="soft" icon="i-heroicons-user-minus" @click="release(registration)">
            Libérer
          </UButton>
          <UButton size="xs" color="error" variant="soft" icon="i-heroicons-x-mark" @click="cancel(registration)">
            Annuler
          </UButton>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { REGISTRATION_PERIOD_STATES, REGISTRATION_STATUSES } from '~/utils/domain'
import { formatLongDate } from '~/utils/dates'
import { registrationStatusMeta } from '~/utils/registrations'
import { useRegistrationPeriodActions, type PeriodRegistration, type RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

// matches : la recherche de l'onglet Vivier (SPEC-020, R12) ; sans elle, toutes les invitations. filtering : une recherche
// est en cours, et le titre dit combien d'invitations elle montre sur le total
const props = defineProps<{ period: RegistrationPeriod, matches?: (registration: PeriodRegistration) => boolean, filtering?: boolean }>()

const { invite, remind, resend, askExtension, release, cancel } = useRegistrationPeriodActions()

const open = computed(() => props.period.state === REGISTRATION_PERIOD_STATES.open)
const allInvitations = computed(() => props.period.registrations.filter((registration) => registration.status === REGISTRATION_STATUSES.invited))
const invitations = computed(() => allInvitations.value.filter((registration) => props.matches?.(registration) ?? true))
const sessionLabel = (registration: PeriodRegistration) => props.period.sessions.find((link) => link.sessionId === registration.invitedSessionId)?.session.label
</script>
