<template>
  <!-- Fiches personnage et trombinoscopes de la session (US-116, découpé de SessionDocumentsManager) -->
  <section>
    <div class="mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <h3 class="font-semibold">Fiches personnage</h3>
        <p class="text-sm text-gray-500">
          {{ sentCharacterSheets.length }}/{{ characterSheets.length }} fiche(s) envoyée(s) ·
          {{ sentTrombinoscopes.length }}/{{ characterSheets.length }} trombinoscope(s) envoyé(s)
        </p>
        <p v-if="outdatedTrombinoscopes.length" class="text-sm text-amber-600">
          {{ outdatedTrombinoscopes.length }} trombinoscope(s) ne sont plus à jour (casting, photos ou réglages modifiés) : générez-les à nouveau.
        </p>
        <p v-if="missingTrombinoscopePhotos" class="text-sm text-amber-600">
          {{ missingTrombinoscopePhotos }} photo(s) manquante(s) dans les trombinoscopes générés.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton color="neutral" variant="soft" :loading="generatingTrombinoscopes" @click="generateTrombinoscopes">
          Générer les trombinoscopes
        </UButton>
        <UButton color="primary" :loading="sending === 'bundle'" :disabled="Boolean(sending) || cooldown === 'bundle' || !bundleReadySheets.length || bundleBlockedByOutdated" @click="sendAll('bundle')">
          Envoyer fiches et trombis
        </UButton>
        <UButton color="neutral" variant="soft" :loading="sending === 'sheets'" :disabled="Boolean(sending) || cooldown === 'sheets' || !pendingCharacterSheets.length" @click="sendAll('sheets')">
          Envoyer fiches seules
        </UButton>
        <UButton color="neutral" variant="soft" :loading="sending === 'trombinoscopes'" :disabled="Boolean(sending) || cooldown === 'trombinoscopes' || !pendingTrombinoscopes.length || trombinoscopesBlockedByOutdated" @click="sendAll('trombinoscopes')">
          Envoyer trombinoscopes seuls
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          :loading="resendingKey === 'character_sheet'"
          :disabled="Boolean(resendingKey) || !outdatedSheets.length"
          @click="resend({ kind: 'character_sheet' }, 'character_sheet', `Renvoyer la fiche à jour aux ${outdatedSheets.length} personne(s) qui ont une version dépassée ?`)"
        >
          Renvoyer les fiches à jour
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          :loading="resendingKey === 'trombinoscope'"
          :disabled="Boolean(resendingKey) || !outdatedSentTrombinoscopes.length || outdatedSentTrombinoscopes.some((sheet) => sheet.trombinoscopeOutdated)"
          @click="resend({ kind: 'trombinoscope' }, 'trombinoscope', `Renvoyer le trombinoscope à jour aux ${outdatedSentTrombinoscopes.length} personne(s) qui ont une version dépassée ?`)"
        >
          Renvoyer les trombis à jour
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
            <UBadge v-if="sheet.trombinoscopeSentAt && sheet.trombinoscopeOutdated" color="warning" variant="subtle" size="xs">
              Trombi envoyé, périmé
            </UBadge>
            <UBadge v-else :color="sheet.trombinoscopeSentAt ? 'success' : sheet.trombinoscopeGeneratedAt ? 'warning' : 'neutral'" variant="subtle" size="xs">
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
            @click="openTest({ type: 'character_sheet', characterId: sheet.character.id })"
          >
            Tester l'email
          </UButton>
          <UButton
            v-if="sheet.sentAt && sheet.readyToSend && sheet.participant.email"
            color="neutral"
            variant="soft"
            size="xs"
            :loading="resendingKey === `character_sheet:${sheet.character.id}`"
            :disabled="Boolean(resendingKey)"
            @click="resend({ kind: 'character_sheet', characterId: sheet.character.id }, `character_sheet:${sheet.character.id}`, `Renvoyer la fiche à ${sheet.participant.name} ?`)"
          >
            Renvoyer la fiche
          </UButton>
          <UButton
            v-if="sheet.trombinoscopeSentAt && sheet.trombinoscopeGeneratedAt && sheet.participant.email"
            color="neutral"
            variant="soft"
            size="xs"
            :loading="resendingKey === `trombinoscope:${sheet.character.id}`"
            :disabled="Boolean(resendingKey) || sheet.trombinoscopeOutdated"
            @click="resend({ kind: 'trombinoscope', characterId: sheet.character.id }, `trombinoscope:${sheet.character.id}`, `Renvoyer le trombinoscope à ${sheet.participant.name} ?`)"
          >
            Renvoyer le trombi
          </UButton>
          <UBadge v-if="sheet.sheetVersionOutdated" color="warning" variant="subtle" size="xs">
            Fiche à renvoyer
          </UBadge>
          <UBadge v-if="sheet.trombinoscopeVersionOutdated && !sheet.trombinoscopeOutdated" color="warning" variant="subtle" size="xs">
            Trombi à renvoyer
          </UBadge>
          <UBadge v-if="sheet.trombinoscopeMissingPhotos" color="warning" variant="subtle" size="xs">
            {{ sheet.trombinoscopeMissingPhotos }} photo(s) manquante(s)
          </UBadge>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { coolDown } from '~/composables/useCooldown'
import { useSessionDocumentActions } from '~/composables/useSessionDocumentActions'
import { apiErrorMessage } from '~/utils/apiErrors'

const { session, characterSheets, serverError, resendingKey, previewingPdfUrl, testingEmail, testEmailCooldownKey, refresh, send, resend, openTest, previewPdf } = useSessionDocumentActions()

type Batch = 'bundle' | 'sheets' | 'trombinoscopes'
const BATCHES: Record<Batch, { path: string, question: string }> = {
  bundle: { path: 'documents/send-character-sheets-and-trombinoscopes', question: 'Envoyer les fiches personnage et les trombinoscopes aux destinataires manquants ?' },
  sheets: { path: 'documents/send-character-sheets', question: 'Envoyer les fiches personnage aux destinataires manquants ?' },
  trombinoscopes: { path: 'documents/send-trombinoscopes', question: 'Envoyer les trombinoscopes aux destinataires manquants ?' }
}

const sending = ref<Batch | ''>('')
const cooldown = ref<Batch | ''>('')
const generatingTrombinoscopes = ref(false)

const pendingCharacterSheets = computed(() => characterSheets.value.filter((sheet) => sheet.readyToSend && !sheet.sentAt))
const pendingTrombinoscopes = computed(() => characterSheets.value.filter((sheet) => sheet.trombinoscopeGeneratedAt && !sheet.trombinoscopeSentAt))
const bundleReadySheets = computed(() => characterSheets.value.filter((sheet) => sheet.readyToSend && sheet.trombinoscopeGeneratedAt))
// Un trombinoscope périmé bloque l'envoi jusqu'à la prochaine génération (US-028)
const outdatedTrombinoscopes = computed(() => characterSheets.value.filter((sheet) => sheet.trombinoscopeOutdated))
const trombinoscopesBlockedByOutdated = computed(() =>
  pendingTrombinoscopes.value.some((sheet) => sheet.participant.email && sheet.trombinoscopeOutdated)
)
const bundleBlockedByOutdated = computed(() =>
  bundleReadySheets.value.some((sheet) => !sheet.bundleSentAt && sheet.participant.email && sheet.trombinoscopeOutdated)
)
const sentCharacterSheets = computed(() => characterSheets.value.filter((sheet) => sheet.sentAt))
const sentTrombinoscopes = computed(() => characterSheets.value.filter((sheet) => sheet.trombinoscopeSentAt))
const missingTrombinoscopePhotos = computed(() =>
  Math.max(0, ...characterSheets.value.map((sheet) => sheet.trombinoscopeMissingPhotos || 0))
)
// Renvoi de la version à jour (US-030)
const outdatedSheets = computed(() => characterSheets.value.filter((sheet) => sheet.sheetVersionOutdated && sheet.readyToSend && sheet.participant.email))
const outdatedSentTrombinoscopes = computed(() => characterSheets.value.filter((sheet) => sheet.trombinoscopeVersionOutdated && sheet.participant.email))

async function sendAll(batch: Batch) {
  if (!confirm(BATCHES[batch].question)) return

  sending.value = batch
  try {
    await send(BATCHES[batch].path)
  } finally {
    sending.value = ''
    coolDown(cooldown, batch, '')
  }
}

async function generateTrombinoscopes() {
  generatingTrombinoscopes.value = true
  try {
    await useApiAction(`/api/sessions/${session().id}/trombinoscopes/generate`, { method: 'POST' })
    serverError.value = ''
    await refresh()
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Erreur inconnue')
  } finally {
    generatingTrombinoscopes.value = false
  }
}
</script>
