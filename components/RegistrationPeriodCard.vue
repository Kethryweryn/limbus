<template>
  <!-- Une période d'inscription (US-117, découpé de RegistrationPeriodsPanel) : réglages, état, puis sa sélection ou ses invitations -->
  <div class="rounded border border-gray-200 p-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium">{{ period.name }}</span>
          <UBadge :color="stateMeta.color" variant="subtle">{{ stateMeta.label }}</UBadge>
          <UBadge color="neutral" variant="outline">{{ formPeriod ? 'Formulaire public' : 'Sur invitation' }}</UBadge>
        </div>
        <p v-if="period.scope === REGISTRATION_PERIOD_SCOPES.game" class="text-sm text-gray-600">
          Inscription permanente : toutes les sessions du jeu sans période dédiée.
        </p>
        <ul v-else class="text-sm text-gray-600">
          <li v-for="link in period.sessions" :key="link.sessionId">
            {{ link.session.name }}<span v-if="link.session.date"> · {{ formatLongDate(link.session.date) }}</span>
            · {{ plural(link.seats, 'place') }}
          </li>
        </ul>
        <p class="text-xs text-gray-500">
          Délai de réponse : {{ plural(period.responseDelayDays, 'jour') }}
          <span v-if="period.closesAt"> · clôture le {{ formatLongDateTime(period.closesAt) }}</span>
          <span v-if="period.notifyTeam"> · équipe prévenue de chaque inscription</span>
        </p>
        <!-- Lien de diffusion à copier pour les annonces (R32) -->
        <div v-if="formPeriod" class="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <code class="rounded bg-gray-100 px-2 py-0.5 text-xs">{{ period.diffusionUrl }}</code>
          <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-clipboard" @click="copyDiffusionUrl(period)">
            Copier le lien
          </UButton>
          <span v-if="period.effectiveState === REGISTRATION_PERIOD_STATES.draft" class="text-xs text-gray-500">actif une fois la période ouverte</span>
        </div>
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

    <!-- Mode formulaire : la sélection des inscriptions reçues (US-087 à US-090) -->
    <RegistrationSelection v-if="formPeriod" :period="period" />
    <RegistrationInvitationList v-else :period="period" />
  </div>
</template>

<script setup lang="ts">
import { REGISTRATION_ENTRY_MODES, REGISTRATION_PERIOD_SCOPES, REGISTRATION_PERIOD_STATE_META, REGISTRATION_PERIOD_STATES } from '~/utils/domain'
import { formatLongDate, formatLongDateTime } from '~/utils/dates'
import { plural, useRegistrationPeriodActions, type RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

const props = defineProps<{ period: RegistrationPeriod }>()

const { copyDiffusionUrl, setState, reopen, edit, remove } = useRegistrationPeriodActions()

const formPeriod = computed(() => props.period.entryMode === REGISTRATION_ENTRY_MODES.form)
const stateMeta = computed(() => props.period.effectiveState in REGISTRATION_PERIOD_STATE_META
  ? REGISTRATION_PERIOD_STATE_META[props.period.effectiveState as keyof typeof REGISTRATION_PERIOD_STATE_META]
  : REGISTRATION_PERIOD_STATE_META.draft)
</script>
