<template>
  <UCard>
    <template #header>
      <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h2 class="font-semibold">Paiements</h2>
          <p class="text-sm text-gray-500">
            {{ paidRows.length }}/{{ rows.length }} paiement(s) validé(s)
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
            <UInput v-model="settings.paymentRibUrl" placeholder="https://..." />
          </UFormField>
        </div>
        <UButton color="primary" variant="soft" :loading="savingSettings" @click="saveSettings">
          Enregistrer
        </UButton>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                {{ row.character.name }}
                <span v-if="row.participant.email"> · {{ row.participant.email }}</span>
                <span v-else> · email manquant</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <UBadge :color="row.paidAt ? 'success' : 'warning'" variant="subtle" size="xs">
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
                :disabled="row.paidAt || !row.participant.email || sendingPaymentParticipantId === row.participant.id || paymentParticipantSendCooldownId === row.participant.id"
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
                :color="row.paidAt ? 'neutral' : 'success'"
                :variant="row.paidAt ? 'soft' : 'solid'"
                :loading="updatingParticipantId === row.participant.id"
                @click="setPaid(row, !row.paidAt)"
              >
                {{ row.paidAt ? 'Annuler le paiement' : 'Valider le paiement' }}
              </UButton>
            </div>
          </div>
        </article>
      </section>

      <p v-if="!rows.length" class="text-sm text-gray-500">
        Aucun personnage casté pour le suivi de paiement.
      </p>
      <p v-if="serverError" class="text-red-500 text-sm">{{ serverError }}</p>
    </div>

    <EmailTestModal
      v-model:open="showTestModal"
      :default-email="props.defaultEmail"
      :preview="testPreview"
      :on-submit="sendPaymentTest"
    />
  </UCard>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

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
const paidRows = computed(() => rows.value.filter((row) => row.paidAt))
const unpaidRows = computed(() => rows.value.filter((row) => !row.paidAt))
const emailedRows = computed(() => rows.value.filter((row) => row.paymentEmailSentAt))
const remindedRows = computed(() => rows.value.filter((row) => row.paymentReminderSentAt))
const testPreview = computed(() => ({
  subject: `[Test] ${testRow.value?.paymentEmailSentAt ? 'Relance paiement' : 'Paiement'} - ${props.paymentsData.session.name}`,
  body: [
    `Bonjour ${firstName(testRow.value?.participant?.name || 'Prénom')},`,
    '',
    testRow.value?.paymentEmailSentAt
      ? `Petit rappel pour le paiement de ta participation à ${props.paymentsData.session.name}.`
      : `Tu peux maintenant régler ta participation à ${props.paymentsData.session.name}.`,
    `Jeu : ${props.paymentsData.session.game?.title || ''}`,
    settings.paymentLinkUrl ? `Lien de paiement : ${settings.paymentLinkUrl}` : '',
    settings.paymentRibUrl ? `RIB : ${settings.paymentRibUrl}` : '',
    '',
    'Merci !'
  ].filter(Boolean).join('\n'),
  attachments: [settings.paymentRibUrl].filter(Boolean)
}))

watch(() => props.paymentsData.session, (session) => {
  settings.paymentRibUrl = session?.paymentRibUrl || ''
  settings.paymentLinkUrl = session?.paymentLinkUrl || ''
}, { immediate: true })

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
  if (!confirm('Envoyer les emails de paiement aux participants impayés ?')) return

  sendingPaymentEmails.value = true
  try {
    await useApiFetch(`/api/sessions/${props.paymentsData.session.id}/payments/send`, {
      method: 'POST',
      body: {}
    })
    serverError.value = ''
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
