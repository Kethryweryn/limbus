<template>
  <UCard>
    <template #header>
      <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h2 class="font-semibold">Paiements</h2>
          <p class="text-sm text-gray-500">
            {{ paidRows.length }}/{{ payingRows.length }} paiement(s) validé(s)
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton color="primary" :loading="sendingPaymentEmails" :disabled="sendingPaymentEmails || paymentSendCooldown || !unpaidRows.length" @click="sendPaymentEmails">
            Envoyer / relancer les manquants
          </UButton>
        </div>
      </div>
    </template>

    <div class="space-y-6">
      <SessionPaymentSettings />
      <SessionPaymentTariffs />
      <SessionPaymentSummary
        :totals="paymentsData.totals"
        :solidarity="paymentsData.solidarity"
        :paid-count="paidRows.length"
        :paying-count="payingRows.length"
      />

      <section class="space-y-3">
        <SessionPaymentRow v-for="row in rows" :key="row.participant.id" :row="row" />
      </section>

      <SessionPaymentDepartures :refunds="paymentsData.refunds || []" :unassigned-payments="paymentsData.unassignedPayments || []" />

      <p v-if="!rows.length" class="text-sm text-gray-500">
        Aucun personnage casté pour le suivi de paiement.
      </p>
      <p v-if="serverError" class="text-red-500 text-sm">{{ serverError }}</p>
    </div>

    <EmailTestModal
      v-model:open="showTestModal"
      :default-email="props.defaultEmail"
      :organizer-emails="organizerEmails"
      :preview="testPreview"
      :on-submit="sendTest"
    />
  </UCard>
</template>

<script setup lang="ts">
import { PAYMENT_STATES } from '~/utils/sessionTariffs'
import { SESSION_ROLES } from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import { coolDown } from '~/composables/useCooldown'
import { provideSessionPaymentActions, type SessionPaymentsData } from '~/composables/useSessionPaymentActions'

// Onglet Paiements d'une session : réglages, tarifs, totaux, une ligne par personne, remboursements et départs
// (US-116 : sections découpées, état et écritures partagés par provideSessionPaymentActions)
const props = withDefaults(defineProps<{
  paymentsData: SessionPaymentsData
  defaultEmail?: string
  onRefresh: () => Promise<unknown>
}>(), { defaultEmail: '' })

const { rows, tariffMode, owes, serverError, showTestModal, testPreview, sendTest } =
  provideSessionPaymentActions(() => props.paymentsData, () => props.onRefresh())

const sendingPaymentEmails = ref(false)
const paymentSendCooldown = ref(false)

const payingRows = computed(() => tariffMode.value ? rows.value.filter((row) => row.dueCents > 0) : rows.value)
const paidRows = computed(() => tariffMode.value ? rows.value.filter((row) => row.state === PAYMENT_STATES.paid) : rows.value.filter((row) => row.paidAt))
const unpaidRows = computed(() => rows.value.filter(owes))
const organizerEmails = computed(() =>
  (props.paymentsData.sessionRoleRecipients || [])
    .filter((recipient) => recipient.role === SESSION_ROLES.organizer && recipient.participant?.email)
    .map((recipient) => recipient.participant.email)
)

async function sendPaymentEmails() {
  if (!confirm('Envoyer les demandes et relances de paiement aux personnes qui doivent encore quelque chose ?')) return

  sendingPaymentEmails.value = true
  try {
    const result = await useApiAction(`/api/sessions/${props.paymentsData.session.id}/payments/send`, { method: 'POST', body: {} })
    serverError.value = result.failures.length
      ? `${result.sentCount} email(s) envoyé(s). Non envoyés : ${result.failures.join(', ')}.`
      : ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Erreur inconnue')
  } finally {
    sendingPaymentEmails.value = false
    coolDown(paymentSendCooldown, true, false)
  }
}
</script>
