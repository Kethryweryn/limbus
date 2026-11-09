<template>
  <!-- Remboursements d'une session annulée ou reportée (US-023), paiements des personnes parties (US-039) ; découpé de SessionPaymentsManager (US-116) -->
  <section v-if="refunds.length" class="space-y-3 rounded border border-gray-200 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-medium">Remboursements</h3>
      <UBadge :color="refundsToDo ? 'warning' : 'success'" variant="subtle" size="xs">
        {{ refundsToDo ? `${refundsToDo} à traiter` : 'Tout est traité' }}
      </UBadge>
    </div>
    <p class="text-sm text-gray-600">
      Session {{ isPostponed ? 'reportée' : 'annulée' }} : pour chaque personne qui a payé, choisissez
      {{ isPostponed ? 'le remboursement ou le report du paiement sur la nouvelle session' : 'le remboursement' }}.
    </p>
    <article v-for="refund in refunds" :key="refund.participant.id" class="flex flex-col gap-2 border-t border-gray-100 pt-2 md:flex-row md:items-center md:justify-between">
      <div class="text-sm">
        <div class="font-medium">{{ refund.participant.name }}</div>
        <div class="text-gray-500">
          Payé le {{ formatEventDate(refund.paidAt) }}<template v-if="refund.receivedCents"> · {{ formatEuros(refund.receivedCents) }} reçu(s)</template>
          <span v-if="refund.refundedAt"> · remboursé le {{ formatEventDate(refund.refundedAt) }}</span>
        </div>
      </div>
      <USelect
        :model-value="toSelectValue(refund.refundStatus)"
        :items="refundOptions"
        value-key="value"
        :disabled="updatingRefundId === refund.participant.id"
        class="w-full md:w-72"
        @update:model-value="(value) => decide(refund, '/refund', { status: fromSelectValue(value) || null })"
      />
    </article>
  </section>

  <section v-else-if="unassignedPayments.length" class="space-y-2 rounded border border-warning-200 bg-warning-50 p-4">
    <h3 class="font-medium text-warning-800">Paiements de personnes parties</h3>
    <p class="text-sm text-warning-700">
      Ces personnes ont payé puis se sont désistées ou ont été retirées : remboursez, gardez, ou transférez le paiement à la personne qui reprend la place.
    </p>
    <article v-for="payment in unassignedPayments" :key="payment.participant.id" class="flex flex-col gap-2 border-t border-warning-100 pt-2 text-sm md:flex-row md:items-center md:justify-between">
      <div class="text-gray-700">
        <div class="font-medium">{{ payment.participant.name }}</div>
        <div>
          Payé le {{ formatEventDate(payment.paidAt) }}<template v-if="payment.receivedCents"> · {{ formatEuros(payment.receivedCents) }}</template>
          <span v-if="payment.participant.email"> · {{ payment.participant.email }}</span>
          <span v-if="payment.transferredTo"> · transféré à {{ payment.transferredTo.name }}</span>
          <span v-if="payment.suggestedStatus" class="text-warning-700"> · proposé : {{ departureLabel(payment.suggestedStatus) }}</span>
        </div>
      </div>
      <div class="flex flex-col gap-1 md:w-72">
        <USelect
          :model-value="pendingTransferId === payment.participant.id ? REFUND_STATUSES.transferred : toSelectValue(payment.refundStatus)"
          :items="departureOptions"
          value-key="value"
          :disabled="updatingRefundId === payment.participant.id"
          @update:model-value="(value) => setDeparture(payment, value)"
        />
        <USelect
          v-if="pendingTransferId === payment.participant.id"
          :model-value="''"
          :items="transferTargetOptions"
          value-key="value"
          placeholder="Remplaçant…"
          @update:model-value="(value) => transferPayment(payment, value)"
        />
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { REFUND_STATUSES, SESSION_STATUSES } from '~/utils/domain'
import { formatEuros } from '~/utils/sessionTariffs'
import { fromSelectValue, noneOption, toSelectValue } from '~/utils/selectOptions'
import { useSessionPaymentActions, type DeparturePayment, type PaymentRefund } from '~/composables/useSessionPaymentActions'
import { formatEventDate } from '~/utils/sessions'

const props = defineProps<{ refunds: PaymentRefund[], unassignedPayments: DeparturePayment[] }>()

const { session, rows, writePayment } = useSessionPaymentActions()

const updatingRefundId = ref('')
const pendingTransferId = ref('')

// Session annulée ou reportée : suivi des remboursements (US-023)
const isPostponed = computed(() => session()?.status === SESSION_STATUSES.postponed)
const refundsToDo = computed(() => props.refunds.filter((refund) => !refund.refundStatus || refund.refundStatus === REFUND_STATUSES.toRefund).length)
const refundOptions = computed(() => [
  noneOption('À décider'),
  { label: 'À rembourser', value: REFUND_STATUSES.toRefund },
  { label: 'Remboursé', value: REFUND_STATUSES.refunded },
  ...(isPostponed.value && session()?.postponedToSessionId
    ? [{ label: 'Reporté sur la nouvelle session', value: REFUND_STATUSES.carriedOver }]
    : [])
])

// Paiement d'une personne partie (US-039) : décision, ou transfert au remplaçant
const departureOptions = [
  noneOption('À décider'),
  { label: 'À rembourser', value: REFUND_STATUSES.toRefund },
  { label: 'Remboursé', value: REFUND_STATUSES.refunded },
  { label: 'Gardé, non remboursé', value: REFUND_STATUSES.kept },
  { label: 'Transféré au remplaçant', value: REFUND_STATUSES.transferred }
]
const departureLabel = (status: string) => departureOptions.find((option) => option.value === status)?.label || ''
// Sans choix, le champ affiche « Remplaçant… » (placeholder)
const transferTargetOptions = computed(() => rows.value.map((row) => ({ label: row.participant.name, value: row.participant.id })))

// Décision sur le paiement d'une personne, avec la version lue de sa ligne (ADR-0036)
async function decide(payment: PaymentRefund | DeparturePayment, path: '/refund' | '/departure', body: Record<string, unknown>) {
  updatingRefundId.value = payment.participant.id
  try {
    if (await writePayment(payment, path, body)) pendingTransferId.value = ''
  } finally {
    updatingRefundId.value = ''
  }
}

function setDeparture(payment: DeparturePayment, value: string) {
  if (value === REFUND_STATUSES.transferred) {
    pendingTransferId.value = payment.participant.id
    return
  }
  pendingTransferId.value = ''
  return decide(payment, '/departure', { status: fromSelectValue(value) || null })
}

function transferPayment(payment: DeparturePayment, targetId: string) {
  if (!targetId) return
  const target = rows.value.find((row) => row.participant.id === targetId)
  if (!confirm(`Transférer le paiement de ${payment.participant.name} à ${target?.participant.name} ? Il comptera comme payé par cette personne.`)) return
  return decide(payment, '/departure', { status: REFUND_STATUSES.transferred, transferToParticipantId: targetId })
}
</script>
