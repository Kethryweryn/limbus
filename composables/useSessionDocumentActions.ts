import { inSentence } from '~/utils/sessionLabels'
import { computed, inject, provide, ref, type InjectionKey } from 'vue'
import type { ApiResponse } from '~/composables/useApiFetch'
import { useApiAction } from '~/composables/useApiFetch'
import { coolDown } from '~/composables/useCooldown'
import { apiErrorMessage } from '~/utils/apiErrors'
import { SESSION_ROLES } from '~/utils/domain'

// Onglet Documents d'une session (US-116) : l'état et les actions partagés par ses sections (documents, fiches)

export type SessionDocumentsData = ApiResponse<'/api/sessions/:id/documents'>
export type SessionDocument = SessionDocumentsData['documents'][number]
export type SessionCharacterSheet = SessionDocumentsData['characterSheets'][number]
type TestTarget = { type: 'document', documentId: string } | { type: 'character_sheet', characterId: string }
type SendResult = { sentCount: number, failures: string[], unrecorded?: string[] }

const KEY: InjectionKey<ReturnType<typeof createActions>> = Symbol('session-document-actions')

// Un échec n'arrête pas l'envoi : les personnes qui n'ont rien reçu sont listées (US-029), et celles dont l'envoi
// est parti sans être enregistré, à ne pas renvoyer
export const sendFailuresMessage = (result: SendResult) => [
  result.failures.length ? `${result.sentCount} email(s) envoyé(s). Non envoyés : ${result.failures.join(', ')}.` : '',
  result.unrecorded?.length ? `Envoyés mais non enregistrés dans le suivi, ne pas renvoyer : ${result.unrecorded.join(', ')}.` : ''
].filter(Boolean).join(' ')

function createActions(data: () => SessionDocumentsData, onRefresh: () => Promise<unknown>) {
  const session = () => data().session
  const serverError = ref('')
  const resendingKey = ref('')
  const previewingPdfUrl = ref('')
  const testingEmail = ref(false)
  const testEmailCooldownKey = ref('')
  const showTestModal = ref(false)
  const testTarget = ref<TestTarget | null>(null)

  const documents = computed(() => data().documents || [])
  const characterSheets = computed(() => data().characterSheets || [])
  const sessionRoleRecipients = computed(() => data().sessionRoleRecipients || [])
  const organizerEmails = computed(() =>
    sessionRoleRecipients.value
      .filter((recipient) => recipient.role === SESSION_ROLES.organizer && recipient.participant?.email)
      .map((recipient) => recipient.participant.email)
  )

  // Envoi, avec le message des échecs et la relecture de l'onglet
  async function send(path: string, body?: Record<string, unknown>) {
    try {
      // Chemin calculé : la réponse, commune aux envois, est donnée ici
      const result = await useApiAction<SendResult, string, 'POST'>(`/api/sessions/${session().id}/${path}`, { method: 'POST', body })
      serverError.value = sendFailuresMessage(result)
      await onRefresh()
    } catch (err) {
      serverError.value = apiErrorMessage(err, 'Erreur inconnue')
    }
  }

  // Renvoi de la version à jour (US-030)
  async function resend(body: Record<string, unknown>, key: string, question: string) {
    if (!confirm(question)) return
    resendingKey.value = key
    try {
      await send('documents/resend', body)
    } finally {
      resendingKey.value = ''
    }
  }

  function openTest(target: TestTarget) {
    testTarget.value = target
    showTestModal.value = true
  }

  async function sendTestEmail(emails: string[]) {
    const target = testTarget.value
    if (!target) return
    const cooldownKey = target.type === 'document' ? `document:${target.documentId}` : `character_sheet:${target.characterId}`

    testingEmail.value = true
    try {
      if (target.type === 'document') {
        await useApiAction(`/api/sessions/${session().id}/documents/test-email`, { method: 'POST', body: { emails, documentIds: [target.documentId] } })
      } else {
        await useApiAction(`/api/sessions/${session().id}/documents/test-character-sheet`, { method: 'POST', body: { emails, characterId: target.characterId } })
      }
      serverError.value = ''
    } catch (err) {
      serverError.value = apiErrorMessage(err, 'Erreur inconnue')
      throw err
    } finally {
      testingEmail.value = false
      coolDown(testEmailCooldownKey, cooldownKey, '')
    }
  }

  const testPreview = computed(() => {
    const target = testTarget.value
    if (!target) return { subject: '', body: '', attachments: [] }

    if (target.type === 'document') {
      const document = documents.value.find((item) => item.id === target.documentId)
      return {
        subject: document ? `[Test] ${document.title}` : '',
        body: [
          `Document de test pour la ${inSentence(session().label)}.`,
          '',
          document?.content || '',
          document?.documentUrl ? `Document lié : ${document.documentUrl}` : ''
        ].filter(Boolean).join('\n'),
        attachments: [document?.pdfUrl, document?.documentUrl].filter((url): url is string => Boolean(url))
      }
    }

    const sheet = characterSheets.value.find((item) => item.character.id === target.characterId)
    return {
      subject: sheet ? `[Test] Fiche personnage - ${sheet.character.name}` : '',
      body: [
        `Fiche personnage de test pour ${session().label}.`,
        '',
        sheet ? `Personnage : ${sheet.character.name}` : '',
        sheet?.character.backgroundDocumentUrl
          ? `Fiche liée : ${sheet.character.backgroundDocumentUrl}`
          : sheet?.character.background || 'Aucun background saisi.',
        sheet?.trombinoscopeUrl ? `Trombinoscope : ${sheet.trombinoscopeUrl}` : 'Trombinoscope non généré.'
      ].filter(Boolean).join('\n'),
      attachments: [sheet?.characterSheetPdfUrl, sheet?.trombinoscopeUrl].filter((url): url is string => Boolean(url))
    }
  })

  // PDF ouvert dans un nouvel onglet, lu avec la session de l'organisatrice
  async function previewPdf(pdfUrl: string | null | undefined) {
    if (!pdfUrl || !import.meta.client) return

    previewingPdfUrl.value = pdfUrl
    serverError.value = ''
    const previewWindow = window.open('about:blank', '_blank')

    try {
      const response = await fetch(pdfUrl, { credentials: 'include', headers: { accept: 'application/pdf' } })
      if (!response.ok) throw new Error('Impossible de charger le PDF')

      const blob = await response.blob()
      const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
      const url = URL.createObjectURL(pdfBlob)

      if (previewWindow) previewWindow.location.href = url
      else window.open(url, '_blank')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      if (previewWindow) previewWindow.close()
      serverError.value = (err as Error)?.message || 'Impossible de vérifier le PDF'
    } finally {
      previewingPdfUrl.value = ''
    }
  }

  return {
    session, documents, characterSheets, sessionRoleRecipients, organizerEmails,
    serverError, resendingKey, previewingPdfUrl, testingEmail, testEmailCooldownKey, showTestModal, testPreview,
    refresh: onRefresh, send, resend, openTest, sendTestEmail, previewPdf
  }
}

/** Crée l'état de l'onglet et le rend aux sections. */
export function provideSessionDocumentActions(data: () => SessionDocumentsData, onRefresh: () => Promise<unknown>) {
  const actions = createActions(data, onRefresh)
  provide(KEY, actions)
  return actions
}

/** État de l'onglet, dans une de ses sections. */
export function useSessionDocumentActions() {
  const actions = inject(KEY)
  if (!actions) throw new Error('useSessionDocumentActions hors de SessionDocumentsManager')
  return actions
}
