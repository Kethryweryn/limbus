<template>
  <!-- Invitations d'une période sur invitation, session par session (US-003, US-005 ; US-117, découpé de RegistrationPeriodsPanel) -->
  <div>
    <div v-for="link in period.sessions" :key="link.sessionId" class="mt-4 space-y-2 border-t border-gray-100 pt-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-gray-700">
            {{ link.session.name }} · {{ plural(invitedCountOf(link), 'invitation') }}
            pour {{ plural(link.seats, 'place') }}
          </h3>
          <div v-if="registrationsOf(link).length" class="mt-1 flex flex-wrap gap-1">
            <UBadge
              v-for="counter in countRegistrationsByStatus(registrationsOf(link))"
              :key="counter.status"
              size="sm"
              :color="counter.color"
              variant="outline"
            >
              {{ counter.label }} : {{ counter.count }}
            </UBadge>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="registrationsOf(link).length"
            size="xs"
            icon="i-heroicons-arrow-down-tray"
            color="neutral"
            variant="soft"
            :href="`/api/sessions/${link.sessionId}/registrations/export`"
            external
            download
          >
            CSV
          </UButton>
          <UButton
            size="xs"
            icon="i-heroicons-envelope"
            color="primary"
            variant="soft"
            :disabled="!open"
            :title="open ? undefined : 'Ouvrez la période pour inviter'"
            @click="invite(period, link)"
          >
            Inviter
          </UButton>
        </div>
      </div>
      <p v-if="invitedCountOf(link) > link.seats" class="text-xs text-warning-600">
        Plus d’invitations que de places.
      </p>
      <ul v-if="registrationsOf(link).length" class="divide-y divide-gray-100 text-sm">
        <li
          v-for="registration in registrationsOf(link)"
          :key="registration.id"
          class="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <span class="font-medium text-gray-800">{{ registration.participant.name }}</span>
            <UBadge class="ml-2" size="sm" :color="registrationStatusMeta(registration).color" variant="subtle">{{ registrationStatusMeta(registration).label }}</UBadge>
            <div class="text-xs text-gray-500">
              {{ registration.email }}
              <template v-if="registration.status === REGISTRATION_STATUSES.withdrawn">
                · {{ withdrawalLabel(registration) }}
              </template>
              <template v-else>
                <span v-if="registration.invitationSentAt"> · invitée le {{ formatLongDate(registration.invitationSentAt) }}</span>
                <span v-else class="text-warning-600"> · email non envoyé</span>
                <span v-if="registration.lastRemindedAt"> · relancée le {{ formatLongDate(registration.lastRemindedAt) }}</span>
                <span v-if="registration.confirmedAt"> · confirmée le {{ formatLongDate(registration.confirmedAt) }}</span>
                <span v-else-if="registration.responseDueAt"> · réponse avant le {{ formatLongDate(registration.responseDueAt) }}</span>
              </template>
            </div>
            <p v-if="registration.missingFromSession" class="text-xs text-warning-600">
              N’est plus participante de la session (retirée depuis l’écran de session).
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click="showDetail(registration)">
              Détail
            </UButton>
            <template v-if="registration.status === REGISTRATION_STATUSES.invited">
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
            </template>
            <UButton
              v-else-if="registration.status === REGISTRATION_STATUSES.confirmed"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { REGISTRATION_PERIOD_STATES, REGISTRATION_STATUSES } from '~/utils/domain'
import { formatLongDate } from '~/utils/dates'
import { countRegistrationsByStatus, invitedCount, registrationStatusMeta } from '~/utils/registrations'
import {
  plural,
  useRegistrationPeriodActions,
  type PeriodRegistration,
  type PeriodSessionLink,
  type RegistrationPeriod
} from '~/composables/useRegistrationPeriodActions'

const props = defineProps<{ period: RegistrationPeriod }>()

const { invite, showDetail, remind, resend, askExtension, release, cancel, withdraw } = useRegistrationPeriodActions()

const open = computed(() => props.period.effectiveState === REGISTRATION_PERIOD_STATES.open)
// Inscriptions de chaque session, regroupées une fois par relecture
const bySession = computed(() => {
  const groups = new Map<string, PeriodRegistration[]>()
  for (const registration of props.period.registrations) {
    if (registration.sessionId) groups.set(registration.sessionId, [...groups.get(registration.sessionId) ?? [], registration])
  }
  return groups
})
const registrationsOf = (link: PeriodSessionLink) => bySession.value.get(link.sessionId) ?? []
const invitedCountOf = (link: PeriodSessionLink) => invitedCount(registrationsOf(link), link.sessionId)

// Refus d'une invitation, désistement par le lien, place libérée ou retrait par une organisatrice (US-005)
function withdrawalLabel(registration: PeriodRegistration) {
  const at = registration.withdrawnAt || registration.respondedAt
  const date = at ? formatLongDate(at) : ''
  if (registration.withdrawnBy) {
    return `${registration.confirmedAt ? 'retirée' : 'place libérée'} le ${date} par ${registration.withdrawnBy.name}`
  }
  if (registration.confirmedAt) return `désistée le ${date} par la personne`
  return registration.source === 'form' ? `retirée le ${date} par la personne` : `invitation déclinée le ${date}`
}
</script>
