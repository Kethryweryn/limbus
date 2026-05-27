<template>
  <UCard>
    <template #header>
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 class="font-semibold">Documents de session</h2>
          <p class="text-sm text-gray-500">{{ documents.length }} document(s)</p>
        </div>
      </div>
    </template>

    <div class="space-y-6">
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
                    :to="`/documents/${document.slug || document.id}`"
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
                  <UBadge v-if="document.character" color="neutral" variant="subtle" size="xs">
                    {{ document.character.name }}
                  </UBadge>
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
                    {{ audienceLabel(document.audience) }}
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
                  @click="sendDocuments([document.id])"
                >
                  Envoyer aux manquants
                </UButton>
                <UButton
                  color="neutral"
                  variant="soft"
                  size="sm"
                  :disabled="testingEmail || testEmailCooldownKey === `document:${document.id}`"
                  @click="openDocumentTest(document)"
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
                  <span v-if="recipient.sentAt"> · envoyé le {{ formatDate(recipient.sentAt) }}</span>
                  <span v-else> · à envoyer</span>
                </div>
              </div>
            </div>

            <p v-else class="mt-3 text-sm text-gray-500">
              Aucun destinataire trouvé pour cette session.
            </p>
          </article>
        </div>
      </section>

      <section>
        <div class="mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 class="font-semibold">Fiches personnage</h3>
            <p class="text-sm text-gray-500">
              {{ sentCharacterSheets.length }}/{{ characterSheets.length }} fiche(s) envoyée(s) ·
              {{ sentTrombinoscopes.length }}/{{ characterSheets.length }} trombinoscope(s) envoyé(s)
            </p>
            <p v-if="missingTrombinoscopePhotos" class="text-sm text-amber-600">
              {{ missingTrombinoscopePhotos }} photo(s) manquante(s) dans les trombinoscopes générés.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="soft" :loading="generatingTrombinoscopes" @click="generateTrombinoscopes">
              Générer les trombinoscopes
            </UButton>
            <UButton color="primary" :loading="sendingBundle" :disabled="sendingBundle || bundleSendCooldown || !bundleReadySheets.length" @click="sendCharacterSheetsAndTrombinoscopes">
              Envoyer fiches et trombis
            </UButton>
            <UButton color="neutral" variant="soft" :loading="sendingSheets" :disabled="sendingSheets || sheetsSendCooldown || !pendingCharacterSheets.length" @click="sendCharacterSheets">
              Envoyer fiches seules
            </UButton>
            <UButton color="neutral" variant="soft" :loading="sendingTrombinoscopes" :disabled="sendingTrombinoscopes || trombinoscopesSendCooldown || !pendingTrombinoscopes.length" @click="sendTrombinoscopes">
              Envoyer trombinoscopes seuls
            </UButton>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div
            v-for="sheet in characterSheets"
            :key="`${sheet.character.id}-${sheet.participant.id}`"
            class="rounded border border-gray-200 p-3 text-sm"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="font-medium">{{ sheet.participant.name }}</div>
                <div class="text-gray-500">{{ sheet.character.name }}</div>
              </div>
              <div class="flex flex-wrap justify-end gap-1">
                <UBadge :color="sheet.sentAt ? 'success' : 'warning'" variant="subtle" size="xs">
                  Fiche {{ sheet.sentAt ? 'envoyée' : sheet.readyToSend ? 'prête' : 'brouillon' }}
                </UBadge>
                <UBadge :color="sheet.trombinoscopeSentAt ? 'success' : sheet.trombinoscopeGeneratedAt ? 'warning' : 'neutral'" variant="subtle" size="xs">
                  Trombi {{ sheet.trombinoscopeSentAt ? 'envoyé' : sheet.trombinoscopeGeneratedAt ? 'généré' : 'à générer' }}
                </UBadge>
                <UBadge :color="sheet.bundleSentAt ? 'success' : 'neutral'" variant="subtle" size="xs">
                  Ensemble {{ sheet.bundleSentAt ? 'envoyé' : 'à envoyer' }}
                </UBadge>
              </div>
            </div>
            <p class="mt-2 text-xs text-gray-500">
              {{ sheet.hasExternalDocument ? 'Document externe lié à la fiche.' : 'Document généré depuis le background.' }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-heroicons-eye"
                :loading="previewingPdfUrl === sheet.characterSheetPdfUrl"
                @click="previewPdf(sheet.characterSheetPdfUrl)"
              >
                Vérifier la fiche
              </UButton>
              <UButton
                v-if="sheet.trombinoscopeUrl"
                type="button"
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-heroicons-eye"
                :loading="previewingPdfUrl === sheet.trombinoscopeUrl"
                @click="previewPdf(sheet.trombinoscopeUrl)"
              >
                Vérifier le trombi
              </UButton>
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                size="xs"
                :disabled="testingEmail || testEmailCooldownKey === `character_sheet:${sheet.character.id}`"
                @click="openCharacterSheetTest(sheet)"
              >
                Tester l'email
              </UButton>
              <UBadge v-if="sheet.trombinoscopeMissingPhotos" color="warning" variant="subtle" size="xs">
                {{ sheet.trombinoscopeMissingPhotos }} photo(s) manquante(s)
              </UBadge>
            </div>
          </div>
        </div>
      </section>

      <section v-if="sessionRoleRecipients.length">
        <h3 class="font-semibold mb-3">Équipe de session</h3>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-for="recipient in sessionRoleRecipients"
            :key="`${recipient.role}-${recipient.participant.id}`"
            color="neutral"
            variant="subtle"
          >
            {{ roleLabel(recipient.role) }} - {{ recipient.participant.name }}
          </UBadge>
        </div>
      </section>

      <p v-if="serverError" class="text-red-500 text-sm">{{ serverError }}</p>
    </div>

    <EmailTestModal
      v-model:open="showTestModal"
      :default-email="props.defaultEmail"
      :organizer-emails="organizerEmails"
      :preview="testPreview"
      :on-submit="sendTestEmail"
    />
  </UCard>
</template>

<script setup>
import { computed, ref } from 'vue'
import { DOCUMENT_AUDIENCE_LABELS, SESSION_ROLES, SESSION_ROLE_LABELS } from '~/utils/domain'

const props = defineProps({
  documentsData: { type: Object, required: true },
  defaultEmail: { type: String, default: '' },
  onRefresh: { type: Function, required: true }
})

const sendingDocumentId = ref('')
const documentSendCooldownId = ref('')
const sendingSheets = ref(false)
const sendingTrombinoscopes = ref(false)
const sendingBundle = ref(false)
const sheetsSendCooldown = ref(false)
const trombinoscopesSendCooldown = ref(false)
const bundleSendCooldown = ref(false)
const generatingTrombinoscopes = ref(false)
const previewingPdfUrl = ref('')
const testingEmail = ref(false)
const testEmailCooldownKey = ref('')
const showTestModal = ref(false)
const testTarget = ref(null)
const serverError = ref('')

const documents = computed(() => props.documentsData.documents || [])
const characterSheets = computed(() => props.documentsData.characterSheets || [])
const sessionRoleRecipients = computed(() => props.documentsData.sessionRoleRecipients || [])
const organizerEmails = computed(() =>
  sessionRoleRecipients.value
    .filter((recipient) => recipient.role === SESSION_ROLES.organizer && recipient.participant?.email)
    .map((recipient) => recipient.participant.email)
)

const pendingCharacterSheets = computed(() => characterSheets.value.filter((sheet) => sheet.readyToSend && !sheet.sentAt))
const pendingTrombinoscopes = computed(() => characterSheets.value.filter((sheet) => sheet.trombinoscopeGeneratedAt && !sheet.trombinoscopeSentAt))
const bundleReadySheets = computed(() => characterSheets.value.filter((sheet) => sheet.readyToSend && sheet.trombinoscopeGeneratedAt))
const sentCharacterSheets = computed(() => characterSheets.value.filter((sheet) => sheet.sentAt))
const sentTrombinoscopes = computed(() => characterSheets.value.filter((sheet) => sheet.trombinoscopeSentAt))
const missingTrombinoscopePhotos = computed(() =>
  Math.max(0, ...characterSheets.value.map((sheet) => sheet.trombinoscopeMissingPhotos || 0))
)
const testPreview = computed(() => {
  if (!testTarget.value) {
    return { subject: '', body: '', attachments: [] }
  }

  if (testTarget.value.type === 'document') {
    const document = documents.value.find((item) => item.id === testTarget.value.documentId)
    return {
      subject: document ? `[Test] ${document.title}` : '',
      body: [
        `Document de test pour la session ${props.documentsData.session.name}.`,
        '',
        document?.content || '',
        document?.documentUrl ? `Document lié : ${document.documentUrl}` : ''
      ].filter(Boolean).join('\n'),
      attachments: [
        document?.pdfUrl,
        document?.documentUrl
      ].filter(Boolean)
    }
  }

  const sheet = characterSheets.value.find((item) => item.character.id === testTarget.value.characterId)
  return {
    subject: sheet ? `[Test] Fiche personnage - ${sheet.character.name}` : '',
    body: [
      `Fiche personnage de test pour ${props.documentsData.session.name}.`,
      '',
      sheet ? `Personnage : ${sheet.character.name}` : '',
      sheet?.character.backgroundDocumentUrl
        ? `Fiche liée : ${sheet.character.backgroundDocumentUrl}`
        : sheet?.character.background || 'Aucun background saisi.',
      sheet?.trombinoscopeUrl ? `Trombinoscope : ${sheet.trombinoscopeUrl}` : 'Trombinoscope non généré.'
    ].filter(Boolean).join('\n'),
    attachments: [
      sheet?.characterSheetPdfUrl,
      sheet?.trombinoscopeUrl
    ].filter(Boolean)
  }
})

const sentRecipients = (document) => document.recipients.filter((recipient) => recipient.sentAt)
const pendingRecipients = (document) => document.recipients.filter((recipient) => !recipient.sentAt)
const audienceLabel = (audience) => DOCUMENT_AUDIENCE_LABELS[audience] || DOCUMENT_AUDIENCE_LABELS.targeted
const roleLabel = (role) => SESSION_ROLE_LABELS[role] || 'Session'

const formatDate = (value) => new Date(value).toLocaleString('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

async function sendDocuments(documentIds) {
  if (!documentIds.length) return
  if (!confirm('Envoyer ce document aux destinataires manquants ?')) return

  sendingDocumentId.value = documentIds[0]
  try {
    await useApiFetch(`/api/sessions/${props.documentsData.session.id}/documents/send`, {
      method: 'POST',
      body: { documentIds }
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    documentSendCooldownId.value = documentIds[0]
    sendingDocumentId.value = ''
    window.setTimeout(() => {
      if (documentSendCooldownId.value === documentIds[0]) {
        documentSendCooldownId.value = ''
      }
    }, 1500)
  }
}

async function sendCharacterSheets() {
  if (!confirm('Envoyer les fiches personnage aux destinataires manquants ?')) return

  sendingSheets.value = true
  try {
    await useApiFetch(`/api/sessions/${props.documentsData.session.id}/documents/send-character-sheets`, {
      method: 'POST'
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    sendingSheets.value = false
    releaseCooldown(sheetsSendCooldown)
  }
}

async function sendTrombinoscopes() {
  if (!confirm('Envoyer les trombinoscopes aux destinataires manquants ?')) return

  sendingTrombinoscopes.value = true
  try {
    await useApiFetch(`/api/sessions/${props.documentsData.session.id}/documents/send-trombinoscopes`, {
      method: 'POST'
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    sendingTrombinoscopes.value = false
    releaseCooldown(trombinoscopesSendCooldown)
  }
}

async function sendCharacterSheetsAndTrombinoscopes() {
  if (!confirm('Envoyer les fiches personnage et les trombinoscopes ?')) return

  sendingBundle.value = true
  try {
    await useApiFetch(`/api/sessions/${props.documentsData.session.id}/documents/send-character-sheets-and-trombinoscopes`, {
      method: 'POST'
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    sendingBundle.value = false
    releaseCooldown(bundleSendCooldown)
  }
}

function releaseCooldown(target) {
  target.value = true
  window.setTimeout(() => {
    target.value = false
  }, 1500)
}

async function generateTrombinoscopes() {
  generatingTrombinoscopes.value = true
  try {
    await useApiFetch(`/api/sessions/${props.documentsData.session.id}/trombinoscopes/generate`, {
      method: 'POST'
    })
    serverError.value = ''
    await props.onRefresh()
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    generatingTrombinoscopes.value = false
  }
}

function openDocumentTest(document) {
  testTarget.value = { type: 'document', documentId: document.id }
  showTestModal.value = true
}

function openCharacterSheetTest(sheet) {
  testTarget.value = { type: 'character_sheet', characterId: sheet.character.id }
  showTestModal.value = true
}

function rememberDocumentReturn(document) {
  if (!import.meta.client) return

  sessionStorage.setItem('limbus:document-return-context', JSON.stringify({
    source: 'session',
    sessionId: props.documentsData.session.id,
    sessionSlug: props.documentsData.session.slug,
    documentId: document.id
  }))
}

async function sendTestEmail(emails) {
  if (!testTarget.value) return

  const cooldownKey = testTarget.value.type === 'document'
    ? `document:${testTarget.value.documentId}`
    : `character_sheet:${testTarget.value.characterId}`

  testingEmail.value = true
  try {
    if (testTarget.value.type === 'document') {
      await useApiFetch(`/api/sessions/${props.documentsData.session.id}/documents/test-email`, {
        method: 'POST',
        body: {
          emails,
          documentIds: [testTarget.value.documentId]
        }
      })
    } else {
      await useApiFetch(`/api/sessions/${props.documentsData.session.id}/documents/test-character-sheet`, {
        method: 'POST',
        body: {
          emails,
          characterId: testTarget.value.characterId
        }
      })
    }
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
    throw err
  } finally {
    testingEmail.value = false
    testEmailCooldownKey.value = cooldownKey
    window.setTimeout(() => {
      if (testEmailCooldownKey.value === cooldownKey) {
        testEmailCooldownKey.value = ''
      }
    }, 1500)
  }
}

async function previewPdf(pdfUrl) {
  if (!pdfUrl || !import.meta.client) return

  previewingPdfUrl.value = pdfUrl
  serverError.value = ''
  const previewWindow = window.open('about:blank', '_blank')

  try {
    const response = await fetch(pdfUrl, {
      credentials: 'include',
      headers: { accept: 'application/pdf' }
    })
    if (!response.ok) {
      throw new Error('Impossible de charger le PDF')
    }

    const blob = await response.blob()
    const pdfBlob = blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' })
    const url = URL.createObjectURL(pdfBlob)

    if (previewWindow) {
      previewWindow.location.href = url
    } else {
      window.open(url, '_blank')
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    if (previewWindow) previewWindow.close()
    serverError.value = err?.message || 'Impossible de vérifier le PDF'
  } finally {
    previewingPdfUrl.value = ''
  }
}
</script>
