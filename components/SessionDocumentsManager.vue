<template>
  <UCard>
    <template #header>
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 class="font-semibold">Documents de session</h2>
          <p class="text-sm text-gray-500">{{ documents.length }} document(s)</p>
        </div>
        <UButton color="primary" :loading="sendingSheets" :disabled="sendingSheets || !pendingCharacterSheets.length" @click="sendCharacterSheets">
          Envoyer les fiches personnage
        </UButton>
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
                  <h4 class="font-medium">{{ document.title }}</h4>
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
                </div>
              </div>

              <UButton
                color="primary"
                size="sm"
                :loading="sendingDocumentId === document.id"
                :disabled="sendingDocumentId === document.id || !pendingRecipients(document).length"
                @click="sendDocuments([document.id])"
              >
                Envoyer aux manquants
              </UButton>
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
              {{ characterSheets.length - pendingCharacterSheets.length }}/{{ characterSheets.length }} fiche(s) envoyée(s)
            </p>
          </div>
          <UButton color="primary" :loading="sendingSheets" :disabled="sendingSheets || !pendingCharacterSheets.length" @click="sendCharacterSheets">
            Envoyer les fiches personnage
          </UButton>
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
              <UBadge :color="sheet.sentAt ? 'success' : 'warning'" variant="subtle" size="xs">
                {{ sheet.sentAt ? 'Envoyée' : 'À envoyer' }}
              </UBadge>
            </div>
            <p class="mt-2 text-xs text-gray-500">
              {{ sheet.hasExternalDocument ? 'Document externe lié à la fiche.' : 'Document généré depuis le background.' }}
            </p>
          </div>
        </div>
      </section>

      <section v-if="sessionRoleRecipients.length">
        <h3 class="font-semibold mb-3">PNJs et organisateurs de session</h3>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-for="recipient in sessionRoleRecipients"
            :key="`${recipient.role}-${recipient.participant.id}`"
            color="neutral"
            variant="subtle"
          >
            {{ recipient.role === 'organizer' ? 'Orga' : 'PNJ' }} - {{ recipient.participant.name }}
          </UBadge>
        </div>
      </section>

      <p v-if="serverError" class="text-red-500 text-sm">{{ serverError }}</p>
    </div>
  </UCard>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  documentsData: { type: Object, required: true },
  onRefresh: { type: Function, required: true }
})

const sendingDocumentId = ref('')
const sendingSheets = ref(false)
const serverError = ref('')

const documents = computed(() => props.documentsData.documents || [])
const characterSheets = computed(() => props.documentsData.characterSheets || [])
const sessionRoleRecipients = computed(() => props.documentsData.sessionRoleRecipients || [])

const pendingCharacterSheets = computed(() => characterSheets.value.filter((sheet) => !sheet.sentAt))

const sentRecipients = (document) => document.recipients.filter((recipient) => recipient.sentAt)
const pendingRecipients = (document) => document.recipients.filter((recipient) => !recipient.sentAt)
const audienceLabel = (audience) => ({
  targeted: 'Ciblage manuel',
  everyone: 'Tout le monde',
  organizers: 'Organisateurs',
  npcs: 'PNJs'
}[audience] || 'Ciblage manuel')

const formatDate = (value) => new Date(value).toLocaleString('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

async function sendDocuments(documentIds) {
  if (!documentIds.length) return

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
    sendingDocumentId.value = ''
  }
}

async function sendCharacterSheets() {
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
  }
}
</script>
