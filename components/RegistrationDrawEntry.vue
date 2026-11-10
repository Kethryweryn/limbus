<template>
  <!-- Un tirage du journal (US-094) : graine, réglages et résultat, annulation comprise (SPEC-020, R8, R10) -->
  <div class="space-y-1 rounded border border-gray-100 p-2 text-xs text-gray-600" data-draw>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span>
        <span class="font-medium">{{ entry.session?.name || 'Session supprimée' }}</span>,
        le {{ formatLongDateTime(entry.createdAt) }}<span v-if="entry.createdBy"> par {{ entry.createdBy.name }}</span>
        · graine <code>{{ entry.seed }}</code>
        <UBadge v-if="entry.cancelledAt" class="ml-1" size="sm" color="neutral" variant="outline">
          Annulé le {{ formatLongDateTime(entry.cancelledAt) }}<span v-if="entry.cancelledBy">&nbsp;par {{ entry.cancelledBy.name }}</span>
        </UBadge>
      </span>
      <UButton v-if="cancellable && !entry.cancelledAt && entry.sessionId" size="xs" color="warning" variant="soft" :loading="cancelling" @click="emit('cancel', entry)">
        Annuler ce tirage
      </UButton>
    </div>
    <p>
      {{ entry.settings.weightNotDrawnBefore ? 'Chances doublées pour les personnes restées sans place' : 'Sans priorité' }} ·
      {{ entry.settings.weightBalance ? `équilibre selon « ${entry.settings.balanceAttribute} »` : 'sans équilibre' }} ·
      liste d’attente de {{ entry.settings.waitlistSize }}
      <span v-if="entry.settings.excludedReplayers?.length"> · {{ plural(entry.settings.excludedReplayers.length, 'rejoueur') }} exclu{{ entry.settings.excludedReplayers.length > 1 ? 's' : '' }}</span>
    </p>
    <p v-for="result in entry.result.sessions" :key="result.sessionId">
      retenues {{ names(result.retained) || 'aucune' }} ;
      en attente {{ names(result.waitlisted) || 'aucune' }}
      <span class="text-gray-400">(ordre : {{ names(result.order.map((item) => item.registrationId)) || '—' }})</span>
    </p>
    <p v-if="entry.result.rejected.length">Restées pré-inscrites : {{ names(entry.result.rejected) }}</p>
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse } from '~/composables/useApiFetch'
import { plural } from '~/composables/useRegistrationPeriodActions'
import { formatLongDateTime } from '~/utils/dates'

type Draw = ApiResponse<'/api/registration-periods/:id/draws'>[number]

defineProps<{
  entry: Draw
  // Noms des inscriptions, « inscription effacée » pour une personne partie
  names: (ids: string[]) => string
  // Faux sous « Sessions passées » : on n'y annule plus un tirage (R10)
  cancellable: boolean
  cancelling?: boolean
}>()
const emit = defineEmits<{ cancel: [entry: Draw] }>()
</script>
