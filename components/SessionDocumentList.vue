<template>
  <!-- Documents ciblés de la session (US-116, découpé de SessionDocumentsManager) -->
  <section>
    <h3 class="font-semibold mb-3">Documents ciblés</h3>
    <div class="space-y-3">
      <article
        v-for="document in documents"
        :key="document.id"
        class="rounded border border-gray-200 p-4"
      >
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div class="min-w-0 space-y-2">
            <div>
              <NuxtLink
                :to="`/documents/${document.slug}`"
                class="font-medium text-gray-950 hover:text-primary-600"
                @click="rememberDocumentReturn(document)"
              >
                {{ document.title }}
              </NuxtLink>
              <p class="text-sm text-gray-500">
                {{ sentRecipients(document).length }}/{{ document.recipients.length }} destinataire(s) envoyé(s)
              </p>
            </div>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="character in document.characters || []"
                :key="character.id"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ character.name }}
              </UBadge>
              <UBadge
                v-for="faction in document.factions || []"
                :key="faction.id"
                color="warning"
                variant="subtle"
                size="xs"
              >
                {{ faction.name }}
              </UBadge>
              <UBadge v-if="document.documentUrl" color="primary" variant="subtle" size="xs">
                Fichier lié
              </UBadge>
              <UBadge color="neutral" variant="outline" size="xs">
                {{ documentAudienceLabel(document) }}
              </UBadge>
              <UBadge :color="document.readyToSend ? 'success' : 'neutral'" variant="subtle" size="xs">
                {{ document.readyToSend ? 'Prêt' : 'Brouillon' }}
              </UBadge>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 lg:justify-end">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-heroicons-eye"
              :loading="previewingPdfUrl === document.pdfUrl"
              @click="previewPdf(document.pdfUrl)"
            >
              Vérifier le PDF
            </UButton>
            <UButton
              color="primary"
              size="sm"
              :loading="sendingDocumentId === document.id"
              :disabled="sendingDocumentId === document.id || documentSendCooldownId === document.id || !document.readyToSend || !pendingRecipients(document).length"
              @click="sendDocument(document.id)"
            >
              Envoyer aux manquants
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              :loading="resendingKey === `document:${document.id}`"
              :disabled="Boolean(resendingKey) || !document.readyToSend || !outdatedRecipients(document).length"
              @click="resend({ kind: 'document', documentId: document.id }, `document:${document.id}`, `Renvoyer la version à jour de « ${document.title} » aux ${outdatedRecipients(document).length} personne(s) qui ont une version dépassée ?`)"
            >
              Renvoyer la version à jour
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              :disabled="testingEmail || testEmailCooldownKey === `document:${document.id}`"
              @click="openTest({ type: 'document', documentId: document.id })"
            >
              Tester l'email
            </UButton>
          </div>
        </div>

        <div v-if="document.recipients.length" class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div
            v-for="recipient in document.recipients"
            :key="`${document.id}-${recipient.participant.id}`"
            class="rounded bg-gray-50 p-2 text-sm"
          >
            <div class="font-medium">{{ recipient.participant.name }}</div>
            <div class="text-gray-500">
              {{ recipient.targetLabel || recipient.character?.name || 'Destinataire session' }}
              <span v-if="recipient.sentAt"> · envoyé le {{ formatEventDate(recipient.sentAt) }}</span>
              <span v-else> · à envoyer</span>
              <span v-if="recipient.versionOutdated" class="text-warning-600"> · version dépassée</span>
            </div>
            <UButton
              v-if="recipient.sentAt && recipient.participant.email && document.readyToSend"
              class="mt-1"
              color="neutral"
              variant="link"
              size="xs"
              :loading="resendingKey === `document:${document.id}:${recipient.participant.id}`"
              :disabled="Boolean(resendingKey)"
              @click="resend({ kind: 'document', documentId: document.id, participantId: recipient.participant.id }, `document:${document.id}:${recipient.participant.id}`, `Renvoyer « ${document.title} » à ${recipient.participant.name} ?`)"
            >
              Renvoyer
            </UButton>
          </div>
        </div>

        <p v-else class="mt-3 text-sm text-gray-500">
          Aucun destinataire trouvé pour cette session.
        </p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { documentAudienceLabel } from '~/utils/documentAudiences'
import { coolDown } from '~/composables/useCooldown'
import { useSessionDocumentActions, type SessionDocument } from '~/composables/useSessionDocumentActions'
import { formatEventDate } from '~/utils/sessions'

const { session, documents, resendingKey, previewingPdfUrl, testingEmail, testEmailCooldownKey, send, resend, openTest, previewPdf } = useSessionDocumentActions()

const sendingDocumentId = ref('')
const documentSendCooldownId = ref('')

const sentRecipients = (document: SessionDocument) => document.recipients.filter((recipient) => recipient.sentAt)
const pendingRecipients = (document: SessionDocument) => document.recipients.filter((recipient) => !recipient.sentAt)
const outdatedRecipients = (document: SessionDocument) => document.recipients.filter((recipient) => recipient.versionOutdated && recipient.participant.email)

async function sendDocument(documentId: string) {
  if (!confirm('Envoyer ce document aux destinataires manquants ?')) return

  sendingDocumentId.value = documentId
  try {
    await send('documents/send', { documentIds: [documentId] })
  } finally {
    sendingDocumentId.value = ''
    coolDown(documentSendCooldownId, documentId, '')
  }
}

// La page du document ramène à l'onglet Documents de la session
function rememberDocumentReturn(document: SessionDocument) {
  if (!import.meta.client) return

  sessionStorage.setItem('limbus:document-return-context', JSON.stringify({
    source: 'session',
    sessionId: session().id,
    sessionSlug: session().slug,
    documentId: document.id
  }))
}
</script>
