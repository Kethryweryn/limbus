<template>
  <!-- Paiement d'une personne : état, envoi, place offerte, tarif et versements (US-116, découpé de SessionPaymentsManager) -->
  <article class="rounded border border-gray-200 p-4">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div class="min-w-0">
        <div class="font-medium">{{ row.participant.name }}</div>
        <div class="text-sm text-gray-500">
          <template v-if="row.characters?.length">{{ row.characters.map((character) => character.name).join(', ') }}</template>
          <span v-else-if="row.awaitingCharacter" class="text-warning-600">Personnage à attribuer</span>
          <template v-else-if="row.npcRole">PNJ</template>
          <template v-else-if="rolesLabel">{{ rolesLabel }}</template>
          <span v-if="row.participant.email"> · {{ row.participant.email }}</span>
          <span v-else> · email manquant</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          <UBadge v-if="tariffMode && stateDisplay" :color="stateDisplay.color" variant="subtle" size="xs">
            {{ stateDisplay.label }}
            <template v-if="row.state === 'partial'"> · reste {{ formatEuros(row.remainingCents) }}</template>
          </UBadge>
          <UBadge v-else-if="row.offered" color="neutral" variant="subtle" size="xs">
            Place offerte
          </UBadge>
          <UBadge v-else :color="row.paidAt ? 'success' : 'warning'" variant="subtle" size="xs">
            {{ row.paidAt ? `Payé le ${formatEventDate(row.paidAt)}` : 'Non payé' }}
          </UBadge>
          <UBadge :color="row.paymentEmailSentAt ? 'success' : 'neutral'" variant="subtle" size="xs">
            {{ row.paymentEmailSentAt ? `Email envoyé le ${formatEventDate(row.paymentEmailSentAt)}` : 'Email non envoyé' }}
          </UBadge>
          <UBadge v-if="row.paymentReminderSentAt" color="warning" variant="subtle" size="xs">
            Relancé le {{ formatEventDate(row.paymentReminderSentAt) }}
          </UBadge>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 lg:justify-end">
        <UButton
          color="primary"
          variant="soft"
          :loading="sending"
          :disabled="!owes(row) || !row.participant.email || sending || sendCooldown"
          @click="sendPaymentEmail"
        >
          {{ row.paymentEmailSentAt ? 'Relancer' : 'Envoyer' }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          :disabled="testingEmail || paymentTestCooldownId === row.participant.id"
          @click="openTest(row)"
        >
          Tester l'email
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          :loading="updating"
          @click="writeRow(row, '/offered', { offered: !row.offered })"
        >
          {{ row.offered ? 'Ne plus offrir la place' : 'Offrir la place' }}
        </UButton>
        <UButton
          v-if="tariffMode && row.paidAt && !row.instalments.length"
          color="neutral"
          variant="soft"
          :loading="updating"
          @click="setPaid(false)"
        >
          Retirer l'ancienne validation
        </UButton>
        <UButton
          v-if="!tariffMode && !row.offered"
          :color="row.paidAt ? 'neutral' : 'success'"
          :variant="row.paidAt ? 'soft' : 'solid'"
          :loading="updating"
          @click="setPaid(!row.paidAt)"
        >
          {{ row.paidAt ? 'Annuler le paiement' : 'Valider le paiement' }}
        </UButton>
      </div>
    </div>

    <div v-if="tariffMode" class="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm">
      <div class="flex flex-wrap items-center gap-2">
        <USelect
          :model-value="row.tariffChosen ? row.tariff?.id : NONE_VALUE"
          :items="tariffOptions"
          value-key="value"
          :disabled="updating"
          class="w-full md:w-72"
          @update:model-value="(value) => writeRow(row, '/tariff', { tariffId: fromSelectValue(value) || null })"
        />
        <span>Dû {{ formatEuros(row.dueCents) }} · reçu {{ formatEuros(row.receivedCents) }} · reste {{ formatEuros(row.remainingCents) }}</span>
      </div>
      <ul v-if="row.instalments.length" class="space-y-1">
        <li v-for="instalment in row.instalments" :key="instalment.id" class="flex flex-wrap items-center gap-2 text-gray-600">
          Versement de {{ formatEuros(instalment.amountCents) }} le {{ formatDay(instalment.receivedAt) }}
          <UButton color="neutral" variant="link" size="xs" :loading="deletingInstalmentId === instalment.id" @click="deleteInstalment(instalment)">
            Supprimer
          </UButton>
        </li>
      </ul>
      <form v-if="row.dueCents > 0" class="flex flex-wrap items-end gap-2" @submit.prevent="addInstalment">
        <UFormField label="Versement (€)">
          <UInput v-model="instalmentForm.amount" type="number" min="0.01" step="0.01" class="w-28" />
        </UFormField>
        <UFormField label="Reçu le">
          <UInput v-model="instalmentForm.receivedAt" type="date" />
        </UFormField>
        <UButton type="submit" color="success" variant="soft" :loading="updating" :disabled="!Number(instalmentForm.amount)">
          Noter le versement
        </UButton>
      </form>
    </div>
  </article>
</template>

<script setup lang="ts">
import { PAYMENT_STATE_DISPLAY, TARIFF_ROLE_LABELS, formatEuros } from '~/utils/sessionTariffs'
import { coolDown } from '~/composables/useCooldown'
import { useSessionPaymentActions, type PaymentRow } from '~/composables/useSessionPaymentActions'
import { formatEventDate } from '~/utils/sessions'
import { fromSelectValue, NONE_VALUE, noneOption } from '~/utils/selectOptions'

const props = defineProps<{ row: PaymentRow }>()

const { tariffMode, tariffs, owes, updatingParticipantId, testingEmail, paymentTestCooldownId, write, writeRow, openTest } = useSessionPaymentActions()

const updating = computed(() => updatingParticipantId.value === props.row.participant.id)
const stateDisplay = computed(() => props.row.state ? PAYMENT_STATE_DISPLAY[props.row.state] : undefined)
const sending = ref(false)
const sendCooldown = ref(false)
const deletingInstalmentId = ref('')

const rolesLabel = computed(() => (props.row.roles || []).map((role) => TARIFF_ROLE_LABELS[role]).join(', '))

const formatDay = (value: string | Date) => new Date(value).toLocaleDateString('fr-FR')

// Tarif d'une personne : celui de son rôle par défaut, ou un autre choisi (US-031)
const tariffOptions = computed(() => {
  const roleTariff = props.row.tariffChosen ? null : props.row.tariff
  return [
    noneOption(roleTariff ? `Tarif du rôle : ${roleTariff.name}` : 'Tarif du rôle'),
    ...tariffs.value.map((tariff) => ({ label: `${tariff.name} (${formatEuros(tariff.amountCents)})`, value: tariff.id }))
  ]
})

// Versement (US-032) : la date du jour par défaut
const today = () => new Date().toISOString().slice(0, 10)
const instalmentForm = reactive({ amount: '', receivedAt: today() })

// Date du clic : validé hors ligne, le paiement la garde (US-048)
function setPaid(paid: boolean) {
  return writeRow(props.row, '', { paid, ...(paid && { paidAt: new Date().toISOString() }) })
}

async function sendPaymentEmail() {
  sending.value = true
  try {
    await write('payments/send', 'POST', { participantId: props.row.participant.id })
  } finally {
    sending.value = false
    coolDown(sendCooldown, true, false)
  }
}

async function addInstalment() {
  updatingParticipantId.value = props.row.participant.id
  try {
    const saved = await write(`payments/${props.row.participant.id}/instalments`, 'POST', { amount: Number(instalmentForm.amount), receivedAt: instalmentForm.receivedAt || null })
    if (saved) Object.assign(instalmentForm, { amount: '', receivedAt: today() })
  } finally {
    updatingParticipantId.value = ''
  }
}

async function deleteInstalment(target: PaymentRow['instalments'][number]) {
  if (!confirm(`Supprimer le versement de ${formatEuros(target.amountCents)} ?`)) return
  deletingInstalmentId.value = target.id
  try {
    await write(`payments/${props.row.participant.id}/instalments/${target.id}`, 'DELETE')
  } finally {
    deletingInstalmentId.value = ''
  }
}
</script>
