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
      <section class="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UFormField label="Lien de paiement">
            <UInput v-model="settings.paymentLinkUrl" placeholder="https://..." />
          </UFormField>
          <UFormField label="RIB PDF">
            <div class="flex flex-wrap items-center gap-2">
              <input
                ref="ribInput"
                type="file"
                accept="application/pdf"
                class="hidden"
                @change="uploadRib"
              >
              <UButton
                color="neutral"
                variant="soft"
                :loading="uploadingRib"
                @click="ribInput?.click()"
              >
                {{ settings.paymentRibUrl ? 'Remplacer le RIB' : 'Téléverser un RIB' }}
              </UButton>
              <UButton
                v-if="settings.paymentRibUrl"
                color="neutral"
                variant="ghost"
                :to="settings.paymentRibUrl"
                target="_blank"
              >
                Voir le PDF
              </UButton>
              <UButton
                v-if="settings.paymentRibUrl"
                color="neutral"
                variant="ghost"
                @click="removeRib"
              >
                Retirer
              </UButton>
            </div>
          </UFormField>
        </div>
        <UButton color="primary" variant="soft" :loading="savingSettings" @click="saveSettings">
          Enregistrer
        </UButton>
      </section>

      <section class="space-y-3 rounded border border-gray-200 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-medium">Tarifs</h3>
          <UBadge color="neutral" variant="subtle" size="xs">
            {{ tariffMode ? 'Montants calculés' : 'Mode simple : case « payé »' }}
          </UBadge>
        </div>
        <p v-if="!tariffMode" class="text-sm text-gray-500">
          Sans tarif, on coche simplement qui a payé. Créez un tarif pour suivre les montants, les versements et les places solidaires.
        </p>
        <ul v-if="tariffs.length" class="space-y-1 text-sm">
          <li v-for="tariff in tariffs" :key="tariff.id" class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-1">
            <span>
              <span class="font-medium">{{ tariff.name }}</span> · {{ formatEuros(tariff.amountCents) }}
              <span v-if="tariff.defaultRole" class="text-gray-500"> · par défaut : {{ TARIFF_ROLE_LABELS[tariff.defaultRole] }}</span>
              <span v-if="tariff.baseTariffId" class="text-gray-500"> · {{ solidarityLabel(tariff) }}</span>
            </span>
            <span class="flex gap-1">
              <UButton color="neutral" variant="ghost" size="xs" @click="editTariff(tariff)">Modifier</UButton>
              <UButton color="error" variant="ghost" size="xs" :loading="deletingTariffId === tariff.id" @click="deleteTariff(tariff)">Supprimer</UButton>
            </span>
          </li>
        </ul>
        <form class="grid grid-cols-1 md:grid-cols-[1fr_8rem_10rem_12rem_auto] gap-2 items-end" @submit.prevent="saveTariff">
          <UFormField :label="tariffForm.id ? 'Modifier le tarif' : 'Nouveau tarif'">
            <UInput v-model="tariffForm.name" placeholder="PJ, PNJ, réduit, soutien…" />
          </UFormField>
          <UFormField label="Montant (€)">
            <UInput v-model="tariffForm.amount" type="number" min="0" step="0.01" />
          </UFormField>
          <UFormField label="Par défaut pour">
            <USelect v-model="tariffForm.defaultRole" :items="defaultRoleOptions" value-key="value" />
          </UFormField>
          <UFormField label="Tarif de base (solidaire)">
            <USelect v-model="tariffForm.baseTariffId" :items="baseTariffOptions" value-key="value" />
          </UFormField>
          <div class="flex gap-1">
            <UButton type="submit" color="primary" variant="soft" :loading="savingTariff" :disabled="!tariffForm.name.trim() || tariffForm.amount === ''">
              {{ tariffForm.id ? 'Enregistrer' : 'Ajouter' }}
            </UButton>
            <UButton v-if="tariffForm.id" color="neutral" variant="ghost" @click="resetTariffForm">Annuler</UButton>
          </div>
        </form>
      </section>

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
          <div class="text-xl font-semibold">{{ paidRows.length }}/{{ payingRows.length }}</div>
        </div>
      </section>

      <section v-if="hasSolidarity" class="space-y-1 rounded border border-gray-200 p-4 text-sm">
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
          <div class="text-xl font-semibold">{{ paidRows.length }}</div>
        </div>
        <div class="rounded border border-gray-200 p-3">
          <div class="text-xs uppercase text-gray-500">Emails envoyés</div>
          <div class="text-xl font-semibold">{{ emailedRows.length }}</div>
        </div>
        <div class="rounded border border-gray-200 p-3">
          <div class="text-xs uppercase text-gray-500">Relances</div>
          <div class="text-xl font-semibold">{{ remindedRows.length }}</div>
        </div>
      </section>

      <section class="space-y-3">
        <article
          v-for="row in rows"
          :key="row.participant.id"
          class="rounded border border-gray-200 p-4"
        >
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div class="min-w-0">
              <div class="font-medium">{{ row.participant.name }}</div>
              <div class="text-sm text-gray-500">
                <template v-if="row.characters?.length">{{ row.characters.map((character) => character.name).join(', ') }}</template>
                <span v-else-if="row.awaitingCharacter" class="text-warning-600">Personnage à attribuer</span>
                <template v-else-if="row.npcRole">PNJ</template>
                <template v-else-if="row.roles?.length">{{ row.roles.map((role) => TARIFF_ROLE_LABELS[role]).join(', ') }}</template>
                <span v-if="row.participant.email"> · {{ row.participant.email }}</span>
                <span v-else> · email manquant</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <UBadge v-if="tariffMode" :color="PAYMENT_STATE_DISPLAY[row.state].color" variant="subtle" size="xs">
                  {{ PAYMENT_STATE_DISPLAY[row.state].label }}
                  <template v-if="row.state === 'partial'"> · reste {{ formatEuros(row.remainingCents) }}</template>
                </UBadge>
                <UBadge v-else :color="row.paidAt ? 'success' : 'warning'" variant="subtle" size="xs">
                  {{ row.paidAt ? `Payé le ${formatDate(row.paidAt)}` : 'Non payé' }}
                </UBadge>
                <UBadge :color="row.paymentEmailSentAt ? 'success' : 'neutral'" variant="subtle" size="xs">
                  {{ row.paymentEmailSentAt ? `Email envoyé le ${formatDate(row.paymentEmailSentAt)}` : 'Email non envoyé' }}
                </UBadge>
                <UBadge v-if="row.paymentReminderSentAt" color="warning" variant="subtle" size="xs">
                  Relancé le {{ formatDate(row.paymentReminderSentAt) }}
                </UBadge>
              </div>
            </div>
            <div class="flex flex-wrap gap-2 lg:justify-end">
              <UButton
                color="primary"
                variant="soft"
                :loading="sendingPaymentParticipantId === row.participant.id"
                :disabled="!owes(row) || !row.participant.email || sendingPaymentParticipantId === row.participant.id || paymentParticipantSendCooldownId === row.participant.id"
                @click="sendPaymentEmail(row)"
              >
                {{ row.paymentEmailSentAt ? 'Relancer' : 'Envoyer' }}
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                :disabled="testingEmail || paymentTestCooldownId === row.participant.id"
                @click="openPaymentTest(row)"
              >
                Tester l'email
              </UButton>
              <UButton
                v-if="tariffMode && row.paidAt && !row.instalments.length"
                color="neutral"
                variant="soft"
                :loading="updatingParticipantId === row.participant.id"
                @click="setPaid(row, false)"
              >
                Retirer l'ancienne validation
              </UButton>
              <UButton
                v-if="!tariffMode"
                :color="row.paidAt ? 'neutral' : 'success'"
                :variant="row.paidAt ? 'soft' : 'solid'"
                :loading="updatingParticipantId === row.participant.id"
                @click="setPaid(row, !row.paidAt)"
              >
                {{ row.paidAt ? 'Annuler le paiement' : 'Valider le paiement' }}
              </UButton>
            </div>
          </div>

          <div v-if="tariffMode" class="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm">
            <div class="flex flex-wrap items-center gap-2">
              <USelect
                :model-value="row.tariffChosen ? row.tariff?.id : ''"
                :items="personTariffOptions(row)"
                value-key="value"
                :disabled="updatingParticipantId === row.participant.id"
                class="w-full md:w-72"
                @update:model-value="(value) => setTariff(row, value)"
              />
              <span>Dû {{ formatEuros(row.dueCents) }} · reçu {{ formatEuros(row.receivedCents) }} · reste {{ formatEuros(row.remainingCents) }}</span>
            </div>
            <ul v-if="row.instalments.length" class="space-y-1">
              <li v-for="instalment in row.instalments" :key="instalment.id" class="flex flex-wrap items-center gap-2 text-gray-600">
                Versement de {{ formatEuros(instalment.amountCents) }} le {{ formatDay(instalment.receivedAt) }}
                <UButton color="neutral" variant="link" size="xs" :loading="deletingInstalmentId === instalment.id" @click="deleteInstalment(row, instalment)">
                  Supprimer
                </UButton>
              </li>
            </ul>
            <form v-if="row.dueCents > 0" class="flex flex-wrap items-end gap-2" @submit.prevent="addInstalment(row)">
              <UFormField label="Versement (€)">
                <UInput v-model="instalmentForms[row.participant.id].amount" type="number" min="0.01" step="0.01" class="w-28" />
              </UFormField>
              <UFormField label="Reçu le">
                <UInput v-model="instalmentForms[row.participant.id].receivedAt" type="date" />
              </UFormField>
              <UButton type="submit" color="success" variant="soft" :loading="updatingParticipantId === row.participant.id" :disabled="!Number(instalmentForms[row.participant.id].amount)">
                Noter le versement
              </UButton>
            </form>
          </div>
        </article>
      </section>

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
              Payé le {{ formatDate(refund.paidAt) }}<template v-if="refund.receivedCents"> · {{ formatEuros(refund.receivedCents) }} reçu(s)</template>
              <span v-if="refund.refundedAt"> · remboursé le {{ formatDate(refund.refundedAt) }}</span>
            </div>
          </div>
          <USelect
            :model-value="refund.refundStatus || ''"
            :items="refundOptions"
            value-key="value"
            :disabled="updatingRefundId === refund.participant.id"
            class="w-full md:w-72"
            @update:model-value="(value) => setRefund(refund, value)"
          />
        </article>
      </section>

      <section v-if="unassignedPayments.length" class="space-y-2 rounded border border-warning-200 bg-warning-50 p-4">
        <h3 class="font-medium text-warning-800">Paiements reçus de personnes sans personnage</h3>
        <p class="text-sm text-warning-700">
          Ces personnes ont payé puis se sont désistées ou ont été retirées : à rembourser, ou à garder, selon votre décision.
        </p>
        <ul class="text-sm text-gray-700">
          <li v-for="payment in unassignedPayments" :key="payment.participant.id">
            {{ payment.participant.name }} · payé le {{ formatDate(payment.paidAt) }}<template v-if="payment.receivedCents"> · {{ formatEuros(payment.receivedCents) }}</template>
            <span v-if="payment.participant.email"> · {{ payment.participant.email }}</span>
          </li>
        </ul>
      </section>

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
      :on-submit="sendPaymentTest"
    />
  </UCard>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { REFUND_STATUSES, SESSION_STATUSES } from '~/utils/domain'
import { PAYMENT_STATE_DISPLAY, PAYMENT_STATES, TARIFF_ROLE_LABELS, formatEuros, paymentAmountLines } from '~/utils/sessionTariffs'

const props = defineProps({
  paymentsData: { type: Object, required: true },
  defaultEmail: { type: String, default: '' },
  onRefresh: { type: Function, required: true }
})

const settings = reactive({
  paymentRibUrl: '',
  paymentLinkUrl: ''
})
const savingSettings = ref(false)
const uploadingRib = ref(false)
const ribInput = ref(null)
const sendingPaymentEmails = ref(false)
const paymentSendCooldown = ref(false)
const sendingPaymentParticipantId = ref('')
const paymentParticipantSendCooldownId = ref('')
const updatingParticipantId = ref('')
const testingEmail = ref(false)
const paymentTestCooldownId = ref('')
const showTestModal = ref(false)
const testRow = ref(null)
const serverError = ref('')

const rows = computed(() => props.paymentsData.rows || [])
const unassignedPayments = computed(() => props.paymentsData.unassignedPayments || [])

// Session annulée ou reportée : suivi des remboursements (US-023)
const refunds = computed(() => props.paymentsData.refunds || [])
const isPostponed = computed(() => props.paymentsData.session?.status === SESSION_STATUSES.postponed)
const refundsToDo = computed(() => refunds.value.filter((refund) => !refund.refundStatus || refund.refundStatus === REFUND_STATUSES.toRefund).length)
const refundOptions = computed(() => [
  { label: 'À décider', value: '' },
  { label: 'À rembourser', value: REFUND_STATUSES.toRefund },
  { label: 'Remboursé', value: REFUND_STATUSES.refunded },
  ...(isPostponed.value && props.paymentsData.session?.postponedToSessionId
    ? [{ label: 'Reporté sur la nouvelle session', value: REFUND_STATUSES.carriedOver }]
    : [])
])
const updatingRefundId = ref('')

async function setRefund(refund, value) {
  updatingRefundId.value = refund.participant.id
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/${refund.participant.id}/refund`, {
      method: 'PUT',
      body: { status: value || null }
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    updatingRefundId.value = ''
  }
}
// Mode tarifs dès qu'un tarif existe (US-031, ADR-0032) ; sinon mode simple, avec la case « payé »
const tariffMode = computed(() => props.paymentsData.mode === 'tariffs')
const tariffs = computed(() => props.paymentsData.tariffs || [])
const totals = computed(() => props.paymentsData.totals || { dueCents: 0, receivedCents: 0, remainingCents: 0 })
const solidarity = computed(() => props.paymentsData.solidarity || {})
const hasSolidarity = computed(() => tariffs.value.some((tariff) => tariff.baseTariffId))
// Qui doit encore quelque chose : reste dû en mode tarifs, case non cochée en mode simple
const owes = (row) => tariffMode.value ? row.remainingCents > 0 && row.state !== PAYMENT_STATES.paid : !row.paidAt
const payingRows = computed(() => tariffMode.value ? rows.value.filter((row) => row.dueCents > 0) : rows.value)
const paidRows = computed(() => tariffMode.value ? rows.value.filter((row) => row.state === PAYMENT_STATES.paid) : rows.value.filter((row) => row.paidAt))
const unpaidRows = computed(() => rows.value.filter(owes))
const emailedRows = computed(() => rows.value.filter((row) => row.paymentEmailSentAt))
const remindedRows = computed(() => rows.value.filter((row) => row.paymentReminderSentAt))
const organizerEmails = computed(() =>
  (props.paymentsData.sessionRoleRecipients || [])
    .filter((recipient) => recipient.role === 'organizer' && recipient.participant?.email)
    .map((recipient) => recipient.participant.email)
)
// Montants de l'aperçu, comme dans l'email (US-034)
const testAmountLines = (row) => tariffMode.value && row?.tariff
  ? paymentAmountLines({ tariffName: row.tariff.name, dueCents: row.dueCents, receivedCents: row.receivedCents, remainingCents: row.remainingCents })
  : []
const testPreview = computed(() => ({
  subject: `[Test] ${testRow.value?.paymentEmailSentAt ? 'Relance paiement' : 'Paiement'} - ${props.paymentsData.session.name}`,
  body: [
    `Bonjour ${firstName(testRow.value?.participant?.name || 'Prénom')},`,
    '',
    testRow.value?.paymentEmailSentAt
      ? `Petit rappel pour le paiement de ta participation à ${props.paymentsData.session.name}.`
      : `Tu peux maintenant régler ta participation à ${props.paymentsData.session.name}.`,
    `Jeu : ${props.paymentsData.session.game?.title || ''}`,
    ...testAmountLines(testRow.value),
    settings.paymentLinkUrl ? `Lien de paiement : ${settings.paymentLinkUrl}` : '',
    settings.paymentRibUrl ? 'Le RIB est joint à cet email.' : '',
    '',
    'Merci !'
  ].filter(Boolean).join('\n'),
  attachments: settings.paymentRibUrl ? ['RIB.pdf'] : []
}))

watch(() => props.paymentsData.session, (session) => {
  settings.paymentRibUrl = session?.paymentRibUrl || ''
  settings.paymentLinkUrl = session?.paymentLinkUrl || ''
}, { immediate: true })

const formatDay = (value) => new Date(value).toLocaleDateString('fr-FR')

const defaultRoleOptions = [
  { label: 'Aucun rôle', value: '' },
  ...Object.entries(TARIFF_ROLE_LABELS).map(([value, label]) => ({ label, value }))
]
const emptyTariffForm = () => ({ id: '', name: '', amount: '', defaultRole: '', baseTariffId: '' })
const tariffForm = reactive(emptyTariffForm())
const savingTariff = ref(false)
const deletingTariffId = ref('')
const baseTariffOptions = computed(() => [
  { label: 'Aucun (tarif normal)', value: '' },
  ...tariffs.value
    .filter((tariff) => tariff.id !== tariffForm.id && !tariff.baseTariffId)
    .map((tariff) => ({ label: `${tariff.name} (${formatEuros(tariff.amountCents)})`, value: tariff.id }))
])

function solidarityLabel(tariff) {
  const base = tariffs.value.find((item) => item.id === tariff.baseTariffId)
  if (!base) return ''
  const difference = tariff.amountCents - base.amountCents
  return difference >= 0
    ? `soutien : +${formatEuros(difference)} par rapport à ${base.name}`
    : `réduit : ${formatEuros(difference)} par rapport à ${base.name}`
}

function resetTariffForm() {
  Object.assign(tariffForm, emptyTariffForm())
}

function editTariff(tariff) {
  Object.assign(tariffForm, {
    id: tariff.id,
    name: tariff.name,
    amount: String(tariff.amountCents / 100),
    defaultRole: tariff.defaultRole || '',
    baseTariffId: tariff.baseTariffId || ''
  })
}

async function saveTariff() {
  savingTariff.value = true
  try {
    const sessionId = props.paymentsData.session.id
    await useApiFetch(tariffForm.id ? `/api/sessions/${sessionId}/tariffs/${tariffForm.id}` : `/api/sessions/${sessionId}/tariffs`, {
      method: tariffForm.id ? 'PUT' : 'POST',
      body: {
        name: tariffForm.name,
        amount: Number(tariffForm.amount),
        defaultRole: tariffForm.defaultRole || null,
        baseTariffId: tariffForm.baseTariffId || null
      }
    })
    resetTariffForm()
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    savingTariff.value = false
  }
}

async function deleteTariff(tariff) {
  if (!confirm(`Supprimer le tarif « ${tariff.name} » ? Les personnes qui l’avaient reprennent le tarif de leur rôle.`)) return
  deletingTariffId.value = tariff.id
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/tariffs/${tariff.id}`, { method: 'DELETE' })
    if (tariffForm.id === tariff.id) resetTariffForm()
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    deletingTariffId.value = ''
  }
}

// Tarif d'une personne : celui de son rôle par défaut, ou un autre choisi (US-031)
function personTariffOptions(row) {
  const roleTariff = row.tariffChosen ? null : row.tariff
  return [
    { label: roleTariff ? `Tarif du rôle : ${roleTariff.name}` : 'Tarif du rôle', value: '' },
    ...tariffs.value.map((tariff) => ({ label: `${tariff.name} (${formatEuros(tariff.amountCents)})`, value: tariff.id }))
  ]
}

async function setTariff(row, value) {
  updatingParticipantId.value = row.participant.id
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/${row.participant.id}/tariff`, {
      method: 'PUT',
      body: { tariffId: value || null }
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    updatingParticipantId.value = ''
  }
}

// Versements (US-032) : un formulaire par personne, la date du jour par défaut
const today = () => new Date().toISOString().slice(0, 10)
const instalmentForms = reactive({})
const deletingInstalmentId = ref('')
watch(rows, (current) => {
  for (const row of current) {
    if (!instalmentForms[row.participant.id]) instalmentForms[row.participant.id] = { amount: '', receivedAt: today() }
  }
}, { immediate: true })

async function addInstalment(row) {
  const form = instalmentForms[row.participant.id]
  updatingParticipantId.value = row.participant.id
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/${row.participant.id}/instalments`, {
      method: 'POST',
      body: { amount: Number(form.amount), receivedAt: form.receivedAt || null }
    })
    Object.assign(form, { amount: '', receivedAt: today() })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    updatingParticipantId.value = ''
  }
}

async function deleteInstalment(row, instalment) {
  if (!confirm(`Supprimer le versement de ${formatEuros(instalment.amountCents)} ?`)) return
  deletingInstalmentId.value = instalment.id
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/${row.participant.id}/instalments/${instalment.id}`, { method: 'DELETE' })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    deletingInstalmentId.value = ''
  }
}

const formatDate = (value) => new Date(value).toLocaleString('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

async function saveSettings() {
  savingSettings.value = true
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/settings`, {
      method: 'PUT',
      body: settings
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    savingSettings.value = false
  }
}

async function uploadRib(event) {
  const file = event.target.files?.[0]
  if (!file) return

  uploadingRib.value = true
  try {
    const formData = new FormData()
    formData.append('rib', file)
    formData.append('sessionId', props.paymentsData.session.id)
    const result = await useApiFetch('/api/uploads/session-payment-ribs', {
      method: 'POST',
      body: formData
    })
    settings.paymentRibUrl = result.ribUrl
    await saveSettings()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Impossible de téléverser le RIB'
  } finally {
    uploadingRib.value = false
    event.target.value = ''
  }
}

async function removeRib() {
  settings.paymentRibUrl = ''
  await saveSettings()
}

function firstName(name) {
  return name.trim().split(/\s+/)[0] || name
}

function releaseCooldown(target) {
  target.value = true
  window.setTimeout(() => {
    target.value = false
  }, 1500)
}

async function sendPaymentEmails() {
  if (!confirm('Envoyer les demandes et relances de paiement aux personnes qui doivent encore quelque chose ?')) return

  sendingPaymentEmails.value = true
  try {
    const result = await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/send`, {
      method: 'POST',
      body: {}
    })
    serverError.value = result?.failures?.length
      ? `${result.sentCount} email(s) envoyé(s). Non envoyés : ${result.failures.join(', ')}.`
      : ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    sendingPaymentEmails.value = false
    releaseCooldown(paymentSendCooldown)
  }
}

async function sendPaymentEmail(row) {
  sendingPaymentParticipantId.value = row.participant.id
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/send`, {
      method: 'POST',
      body: { participantId: row.participant.id }
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    sendingPaymentParticipantId.value = ''
    paymentParticipantSendCooldownId.value = row.participant.id
    window.setTimeout(() => {
      if (paymentParticipantSendCooldownId.value === row.participant.id) {
        paymentParticipantSendCooldownId.value = ''
      }
    }, 1500)
  }
}

function openPaymentTest(row) {
  testRow.value = row
  showTestModal.value = true
}

async function sendPaymentTest(emails) {
  const participantId = testRow.value?.participant?.id || ''
  testingEmail.value = true
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/test-email`, {
      method: 'POST',
      body: { emails, participantId }
    })
  } finally {
    testingEmail.value = false
    paymentTestCooldownId.value = participantId
    window.setTimeout(() => {
      if (paymentTestCooldownId.value === participantId) {
        paymentTestCooldownId.value = ''
      }
    }, 1500)
  }
}

async function setPaid(row, paid) {
  updatingParticipantId.value = row.participant.id
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/${row.participant.id}`, {
      method: 'PUT',
      body: { paid }
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    updatingParticipantId.value = ''
  }
}
</script>
