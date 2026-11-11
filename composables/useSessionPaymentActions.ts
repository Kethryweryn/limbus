import { inSentence, withGame } from '~/utils/sessionLabels'
import { computed, inject, provide, ref, watch, type InjectionKey } from 'vue'
import type { ApiResponse } from '~/composables/useApiFetch'
import { useApiAction, useApiFetch } from '~/composables/useApiFetch'
import { coolDown } from '~/composables/useCooldown'
import { apiErrorMessage } from '~/utils/apiErrors'
import { NO_VERSION } from '~/utils/offlineSync'
import { PAYMENT_STATES, paymentAmountLines, withdrawalDeadlineLine } from '~/utils/sessionTariffs'

// Onglet Paiements d'une session (US-116) : l'état et les écritures partagés par ses sections

export type SessionPaymentsData = ApiResponse<'/api/sessions/:id/payments'>
export type PaymentRow = SessionPaymentsData['rows'][number]
export type PaymentTariff = SessionPaymentsData['tariffs'][number]
export type PaymentRefund = SessionPaymentsData['refunds'][number]
export type DeparturePayment = SessionPaymentsData['unassignedPayments'][number]

type Method = 'POST' | 'PUT' | 'DELETE'
type PaymentLine = { participant: { id: string, name: string }, paymentUpdatedAt?: string | null }

const KEY: InjectionKey<ReturnType<typeof createActions>> = Symbol('session-payment-actions')

function createActions(data: () => SessionPaymentsData, onRefresh: () => Promise<unknown>) {
  const session = () => data().session
  const serverError = ref('')
  const updatingParticipantId = ref('')
  const testingEmail = ref(false)
  const paymentTestCooldownId = ref('')
  const showTestModal = ref(false)
  const testRow = ref<PaymentRow | null>(null)

  // Réglages de la session : lien, RIB, date limite de désistement (US-031, US-040)
  const settings = ref({ paymentRibUrl: '', paymentLinkUrl: '', withdrawalDeadline: '' })
  watch(() => data().session, (current) => {
    settings.value.paymentRibUrl = current?.paymentRibUrl || ''
    settings.value.paymentLinkUrl = current?.paymentLinkUrl || ''
    settings.value.withdrawalDeadline = current?.withdrawalDeadline ? new Date(current.withdrawalDeadline).toISOString().slice(0, 10) : ''
  }, { immediate: true })

  const rows = computed(() => data().rows || [])
  // Mode tarifs dès qu'un tarif existe (US-031, ADR-0032) ; sinon mode simple, avec la case « payé »
  const tariffMode = computed(() => data().mode === 'tariffs')
  const tariffs = computed(() => data().tariffs || [])
  // Qui doit encore quelque chose : reste dû en mode tarifs, case non cochée en mode simple
  const owes = (row: PaymentRow) => tariffMode.value ? row.remainingCents > 0 && row.state !== PAYMENT_STATES.paid : !row.paidAt

  /**
   * Écriture du tableau puis relecture de l'onglet ; l'erreur s'affiche sous le tableau. Une modification d'une ligne
   * envoie la version lue (ADR-0036) et peut partir en file hors ligne sous le nom de la personne (offlineLabel).
   */
  async function write(path: string, method: Method, body?: Record<string, unknown>, offlineLabel?: string) {
    try {
      // Chemin calculé : la réponse n'est pas lue
      await useApiFetch<unknown, string, Method>(`/api/sessions/${session().id}/${path}`, { method, body, offlineLabel })
      serverError.value = ''
      await onRefresh()
      return true
    } catch (err) {
      serverError.value = apiErrorMessage(err, 'Erreur inconnue')
      return false
    }
  }

  // Écriture sur le paiement d'une personne, avec la version lue de sa ligne
  function writePayment(row: PaymentLine, path: string, body: Record<string, unknown>) {
    return write(`payments/${row.participant.id}${path}`, 'PUT', { ...body, updatedAt: row.paymentUpdatedAt || NO_VERSION }, row.participant.name)
  }

  // La même, depuis la ligne de la personne dans le tableau : ses boutons attendent la réponse
  async function writeRow(row: PaymentLine, path: string, body: Record<string, unknown>) {
    updatingParticipantId.value = row.participant.id
    try {
      return await writePayment(row, path, body)
    } finally {
      updatingParticipantId.value = ''
    }
  }

  async function saveSettings() {
    return await write('payments/settings', 'PUT', {
      ...settings.value,
      withdrawalDeadline: settings.value.withdrawalDeadline || null,
      updatedAt: session().paymentSettingsUpdatedAt || NO_VERSION
    })
  }

  function openTest(row: PaymentRow) {
    testRow.value = row
    showTestModal.value = true
  }

  async function sendTest(emails: string[]) {
    const participantId = testRow.value?.participant?.id || ''
    testingEmail.value = true
    try {
      await useApiAction(`/api/sessions/${session().id}/payments/test-email`, { method: 'POST', body: { emails, participantId } })
    } finally {
      testingEmail.value = false
      coolDown(paymentTestCooldownId, participantId, '')
    }
  }

  // Aperçu de l'email de paiement, comme celui envoyé (US-034)
  const testPreview = computed(() => {
    const row = testRow.value
    const amountLines = tariffMode.value && row?.tariff
      ? paymentAmountLines({ tariffName: row.tariff.name, dueCents: row.dueCents, receivedCents: row.receivedCents, remainingCents: row.remainingCents })
      : []
    return {
      subject: `[Test] ${row?.paymentEmailSentAt ? 'Relance paiement' : 'Paiement'} - ${withGame(session().game?.title ?? '', session().label)}`,
      body: [
        `Bonjour ${firstName(row?.participant?.name || 'Prénom')},`,
        '',
        row?.paymentEmailSentAt
          ? `Petit rappel pour le paiement de ta participation à la ${inSentence(session().label)}.`
          : `Tu peux maintenant régler ta participation à la ${inSentence(session().label)}.`,
        `Jeu : ${session().game?.title || ''}`,
        ...amountLines,
        settings.value.paymentLinkUrl ? `Lien de paiement : ${settings.value.paymentLinkUrl}` : '',
        settings.value.paymentRibUrl ? 'Le RIB est joint à cet email.' : '',
        withdrawalDeadlineLine(settings.value.withdrawalDeadline) || '',
        '',
        'Merci !'
      ].filter(Boolean).join('\n'),
      attachments: settings.value.paymentRibUrl ? ['RIB.pdf'] : []
    }
  })

  return {
    session, rows, tariffMode, tariffs, owes, settings, serverError, updatingParticipantId,
    testingEmail, paymentTestCooldownId, showTestModal, testPreview,
    refresh: onRefresh, write, writePayment, writeRow, saveSettings, openTest, sendTest
  }
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

/** Crée l'état de l'onglet et le rend aux sections. */
export function provideSessionPaymentActions(data: () => SessionPaymentsData, onRefresh: () => Promise<unknown>) {
  const actions = createActions(data, onRefresh)
  provide(KEY, actions)
  return actions
}

/** État de l'onglet, dans une de ses sections. */
export function useSessionPaymentActions() {
  const actions = inject(KEY)
  if (!actions) throw new Error('useSessionPaymentActions hors de SessionPaymentsManager')
  return actions
}
