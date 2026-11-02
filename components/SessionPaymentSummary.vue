<template>
  <!-- Totaux des paiements : montants en mode tarifs, places solidaires, décomptes en mode simple (US-116, découpé de SessionPaymentsManager) -->
  <section v-if="tariffMode" class="grid grid-cols-1 md:grid-cols-4 gap-3">
    <div class="rounded border border-gray-200 p-3">
      <div class="text-xs uppercase text-gray-500">Dû</div>
      <div class="text-xl font-semibold">{{ formatEuros(totals.dueCents) }}</div>
    </div>
    <div class="rounded border border-gray-200 p-3">
      <div class="text-xs uppercase text-gray-500">Reçu</div>
      <div class="text-xl font-semibold">{{ formatEuros(totals.receivedCents) }}</div>
    </div>
    <div class="rounded border border-gray-200 p-3">
      <div class="text-xs uppercase text-gray-500">Reste à recevoir</div>
      <div class="text-xl font-semibold">{{ formatEuros(totals.remainingCents) }}</div>
    </div>
    <div class="rounded border border-gray-200 p-3">
      <div class="text-xs uppercase text-gray-500">Payés</div>
      <div class="text-xl font-semibold">{{ paidCount }}/{{ payingCount }}</div>
    </div>
  </section>

  <section v-if="hasSolidarity && solidarity" class="space-y-1 rounded border border-gray-200 p-4 text-sm">
    <h3 class="font-medium">Places solidaires</h3>
    <p>Apport des soutiens : {{ formatEuros(solidarity.contributionAssigned) }} attribué, dont {{ formatEuros(solidarity.contributionReceived) }} encaissé.</p>
    <p>Coût des réductions attribuées : {{ formatEuros(solidarity.reductionCost) }}.</p>
    <p :class="solidarity.balanceAssigned < 0 ? 'text-warning-700' : 'text-gray-700'">
      Solde : {{ formatEuros(solidarity.balanceAssigned) }} sur les tarifs attribués, {{ formatEuros(solidarity.balanceReceived) }} sur l'argent encaissé.
    </p>
  </section>

  <section v-else-if="!tariffMode" class="grid grid-cols-1 md:grid-cols-4 gap-3">
    <div class="rounded border border-gray-200 p-3">
      <div class="text-xs uppercase text-gray-500">À suivre</div>
      <div class="text-xl font-semibold">{{ rows.length }}</div>
    </div>
    <div class="rounded border border-gray-200 p-3">
      <div class="text-xs uppercase text-gray-500">Payés</div>
      <div class="text-xl font-semibold">{{ paidCount }}</div>
    </div>
    <div class="rounded border border-gray-200 p-3">
      <div class="text-xs uppercase text-gray-500">Emails envoyés</div>
      <div class="text-xl font-semibold">{{ rows.filter((row) => row.paymentEmailSentAt).length }}</div>
    </div>
    <div class="rounded border border-gray-200 p-3">
      <div class="text-xs uppercase text-gray-500">Relances</div>
      <div class="text-xl font-semibold">{{ rows.filter((row) => row.paymentReminderSentAt).length }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatEuros } from '~/utils/sessionTariffs'
import { useSessionPaymentActions, type SessionPaymentsData } from '~/composables/useSessionPaymentActions'

defineProps<{
  totals: SessionPaymentsData['totals']
  solidarity: SessionPaymentsData['solidarity'] | null
  paidCount: number
  payingCount: number
}>()

const { rows, tariffMode, tariffs } = useSessionPaymentActions()
const hasSolidarity = computed(() => tariffs.value.some((tariff) => tariff.baseTariffId))
</script>
