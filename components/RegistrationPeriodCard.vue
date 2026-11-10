<template>
  <!-- Onglet Réglages (SPEC-020, R13) : état, lien de diffusion, délai, et les réglages du vivier et du formulaire -->
  <div class="rounded border border-gray-200 p-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium">Vivier</span>
          <UBadge :color="stateMeta.color" variant="subtle">{{ stateMeta.label }}</UBadge>
        </div>
        <p class="text-xs text-gray-500">
          Délai de réponse : {{ plural(period.responseDelayDays, 'jour') }}
          <span v-if="period.notifyTeam"> · équipe prévenue de chaque réponse</span>
        </p>
        <!-- Lien de diffusion à copier pour les annonces (R32) -->
        <div class="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <code class="rounded bg-gray-100 px-2 py-0.5 text-xs">{{ period.diffusionUrl }}</code>
          <UButton size="xs" color="neutral" variant="soft" icon="i-heroicons-clipboard" @click="copyDiffusionUrl(period)">
            Copier le lien
          </UButton>
          <span v-if="period.state === REGISTRATION_PERIOD_STATES.draft" class="text-xs text-gray-500">actif une fois le vivier ouvert</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="period.state === REGISTRATION_PERIOD_STATES.open"
          size="sm"
          color="warning"
          variant="soft"
          @click="setState(period, REGISTRATION_PERIOD_STATES.closed)"
        >
          Fermer
        </UButton>
        <UButton
          v-else
          size="sm"
          color="success"
          variant="soft"
          @click="setState(period, REGISTRATION_PERIOD_STATES.open)"
        >
          Ouvrir
        </UButton>
        <UButton size="sm" color="neutral" variant="soft" icon="i-heroicons-pencil-square" @click="edit(period)">
          Réglages
        </UButton>
        <UButton size="sm" color="neutral" variant="soft" icon="i-heroicons-clipboard-document-list" @click="emit('form')">
          Formulaire
        </UButton>
        <UButton size="sm" color="error" variant="soft" icon="i-heroicons-trash" @click="remove(period)">
          Supprimer le vivier
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { REGISTRATION_PERIOD_STATE_META, REGISTRATION_PERIOD_STATES, metaOf } from '~/utils/domain'
import { plural, useRegistrationPeriodActions, type RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

const props = defineProps<{ period: RegistrationPeriod }>()
const emit = defineEmits<{ form: [] }>()

const { copyDiffusionUrl, setState, edit, remove } = useRegistrationPeriodActions()

const stateMeta = computed(() => metaOf(REGISTRATION_PERIOD_STATE_META, props.period.state) ?? REGISTRATION_PERIOD_STATE_META.draft)
</script>
