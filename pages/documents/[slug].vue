<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <UButton :to="documentBackTo" color="neutral" variant="ghost" icon="i-heroicons-arrow-left" class="mb-3">
          {{ documentBackLabel }}
        </UButton>
        <h1 class="text-2xl font-bold">{{ documentItem?.title || 'Document' }}</h1>
        <p class="text-sm text-gray-500">{{ documentItem?.game?.title || 'Jeu inconnu' }}</p>
      </div>
      <div v-if="documentItem && !isEditing" class="flex flex-wrap gap-2">
        <UBadge :color="documentItem.readyToSend ? 'success' : 'neutral'" variant="subtle">
          {{ documentItem.readyToSend ? 'Prêt' : 'Brouillon' }}
        </UBadge>
        <UBadge color="neutral" variant="outline">
          {{ documentAudienceLabel(documentItem) }}
        </UBadge>
        <UBadge v-if="isInArchivedGame(documentItem)" color="neutral" variant="solid">
          Archivé
        </UBadge>
        <UButton icon="i-heroicons-pencil-square" color="primary" @click="startEdit">
          Modifier
        </UButton>
      </div>
      <SheetDeleteButton
        v-if="documentItem"
        :url="`/api/documents/${documentItem.id}`"
        :confirm-text="DELETE_CONFIRMATIONS.document"
        :list-path="documentBackTo"
      />
    </div>

    <DocumentForm
      v-if="documentItem && isEditing && editableDocument"
      v-model:document="editableDocument"
      :games="games"
      :characters="characters"
      :factions="factions"
      mode="edit"
      @submit="saveDocument"
      @cancel="cancelEdit"
    />

    <div v-else-if="documentItem" class="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-6">
      <UCard>
        <template #header>
          Contenu
        </template>

        <div class="space-y-4">
          <p v-if="documentItem.content" class="whitespace-pre-line leading-7 text-gray-700">
            {{ documentItem.content }}
          </p>
          <p v-else class="text-sm text-gray-500">
            Aucun corps renseigné.
          </p>

          <UButton
            v-if="documentItem.documentUrl"
            :to="documentItem.documentUrl"
            target="_blank"
            color="neutral"
            variant="soft"
            icon="i-heroicons-arrow-top-right-on-square"
          >
            Ouvrir le document lié
          </UButton>
        </div>
      </UCard>

      <UCard>
        <template #header>
          Cibles
        </template>

        <div class="space-y-4">
          <div>
            <h2 class="text-sm font-semibold mb-2">Personnages</h2>
            <div class="flex flex-wrap gap-1">
              <NuxtLink
                v-for="character in documentItem.characters || []"
                :key="character.id"
                :to="`/characters/${character.slug}`"
              >
                <UBadge color="neutral" variant="subtle" class="cursor-pointer">
                  {{ character.name }}
                </UBadge>
              </NuxtLink>
              <span
                v-if="!documentItem.characters?.length"
                class="text-sm text-gray-500"
              >
                Aucun
              </span>
            </div>
          </div>

          <div>
            <h2 class="text-sm font-semibold mb-2">Groupes</h2>
            <div class="flex flex-wrap gap-1">
              <NuxtLink
                v-for="faction in documentItem.factions || []"
                :key="faction.id"
                :to="`/factions/${faction.slug}`"
              >
                <UBadge color="warning" variant="subtle" class="cursor-pointer">
                  {{ faction.name }}
                </UBadge>
              </NuxtLink>
              <span v-if="!documentItem.factions?.length" class="text-sm text-gray-500">Aucun</span>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <UAlert v-else-if="loadError" color="error" variant="soft" :description="loadError" />
    <UCard v-else>
      Chargement...
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { DELETE_CONFIRMATIONS } from '~/utils/deleteConfirmations'
import { isInArchivedGame } from '~/utils/games'
import { computed, onMounted, ref } from 'vue'
import { loadErrorMessage } from '~/utils/apiErrors'
import DocumentForm from '@/components/DocumentForm.vue'
import { documentAudienceLabel } from '~/utils/documentAudiences'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { DocumentDraft } from '~/utils/writingDrafts'
import { sheetReads } from '~/utils/offlinePlan'

type DocumentDetail = ApiResponse<'/api/documents/:id'>
// D'où l'on vient : la liste des documents ou l'onglet Documents d'une session
type ReturnContext = { source: string, documentId: string, sessionId?: string, sessionSlug?: string }

const route = useRoute()
const documentItem = ref<DocumentDetail | null>(null)
const games = ref<ApiResponse<'/api/games'>>([])
const characters = ref<ApiResponse<'/api/characters'>>([])
const factions = ref<ApiResponse<'/api/factions'>>([])
const { isEditing, draft: editableDocument, startEdit, cancelEdit, closeAfterSave, closeAfterQueued } = useSheetEdit(() => documentItem.value ? documentFormPayload(documentItem.value) : null)
const returnContext = ref<ReturnContext | null>(null)

const documentBackTo = computed(() => {
  // Retour à la session par son slug (la page des sessions ne s'ouvre pas par identifiant), sinon à la liste
  if (returnContext.value?.source === 'session') {
    return {
      path: returnContext.value.sessionSlug ? `/sessions/${returnContext.value.sessionSlug}` : '/sessions',
      query: { tab: 'documents' }
    }
  }

  return '/documents'
})

const documentBackLabel = computed(() =>
  returnContext.value?.source === 'session' ? 'Documents de session' : 'Documents'
)

async function loadData() {
  const [data, gamesData, charactersData, factionsData] = await Promise.all([
    useApiFetch(sheetReads.document(String(route.params.slug)), { offlineCache: true }),
    useApiFetch('/api/games', { offlineCache: true }),
    useApiFetch('/api/characters', { offlineCache: true }),
    useApiFetch('/api/factions', { offlineCache: true })
  ])

  documentItem.value = data
  editableDocument.value = documentFormPayload(data)
  games.value = gamesData
  characters.value = charactersData
  factions.value = factionsData
  ensureDocumentReturnContext(data)
}

function documentFormPayload(document: DocumentDetail): DocumentDraft {
  return {
    ...document,
    content: document.content || '',
    documentUrl: document.documentUrl || '',
    characterIds: document.characters?.map((character) => character.id) || [],
    factionIds: document.factions?.map((faction) => faction.id) || []
  }
}

async function saveDocument() {
  if (!editableDocument.value?.id) return

  const updatedDocument = await useApiFetch(`/api/documents/${editableDocument.value.id}`, {
    method: 'PUT',
    body: editableDocument.value
  })

  if (isOfflineQueued(updatedDocument)) return closeAfterQueued(documentItem)
  documentItem.value = updatedDocument
  await closeAfterSave(`/documents/${updatedDocument.slug}`)
}

function readDocumentReturnContext(): ReturnContext | null {
  if (!import.meta.client) return null

  try {
    const raw = sessionStorage.getItem('limbus:document-return-context')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function ensureDocumentReturnContext(documentData: DocumentDetail) {
  const storedContext = readDocumentReturnContext()
  returnContext.value = storedContext?.documentId === documentData?.id ? storedContext : null
  if (returnContext.value || !import.meta.client || !documentData?.id) return

  const fallbackContext = { source: 'documents', documentId: documentData.id }
  returnContext.value = fallbackContext
  sessionStorage.setItem('limbus:document-return-context', JSON.stringify(fallbackContext))
}

// Fiche absente (lien ancien, slug changé) ou refusée : un message plutôt qu'un chargement sans fin
const loadError = ref('')
onMounted(async () => {
  try {
    await loadData()
  } catch (err) {
    loadError.value = loadErrorMessage(err, 'Document introuvable.')
  }
})
</script>
