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
          {{ audienceLabel(documentItem.audience) }}
        </UBadge>
        <UButton icon="i-heroicons-pencil-square" color="primary" @click="startEdit">
          Modifier
        </UButton>
      </div>
    </div>

    <DocumentForm
      v-if="documentItem && isEditing"
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
                v-if="documentItem.character"
                :to="`/characters/${documentItem.character.slug}`"
              >
                <UBadge color="neutral" variant="subtle" class="cursor-pointer">
                  {{ documentItem.character.name }}
                </UBadge>
              </NuxtLink>
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
                v-if="!documentItem.character && !documentItem.characters?.length"
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

    <UCard v-else>
      Chargement...
    </UCard>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import DocumentForm from '@/components/DocumentForm.vue'
import { DOCUMENT_AUDIENCE_LABELS } from '~/utils/domain'

const route = useRoute()
const router = useRouter()
const documentItem = ref(null)
const editableDocument = ref(null)
const games = ref([])
const characters = ref([])
const factions = ref([])
const isEditing = ref(route.query.edit === '1')
const returnContext = ref(null)

const documentBackTo = computed(() => {
  if (returnContext.value?.source === 'session') {
    return {
      path: `/sessions/${returnContext.value.sessionSlug || returnContext.value.sessionId}`,
      query: { tab: 'documents' }
    }
  }

  return '/documents'
})

const documentBackLabel = computed(() =>
  returnContext.value?.source === 'session' ? 'Documents de session' : 'Documents'
)

const audienceLabel = (audience) => DOCUMENT_AUDIENCE_LABELS[audience] || DOCUMENT_AUDIENCE_LABELS.targeted

async function loadData() {
  const [data, gamesData, charactersData, factionsData] = await Promise.all([
    useApiFetch(`/api/documents/${route.params.id}`),
    useApiFetch('/api/games'),
    useApiFetch('/api/characters'),
    useApiFetch('/api/factions')
  ])

  documentItem.value = data
  editableDocument.value = documentFormPayload(data)
  games.value = gamesData
  characters.value = charactersData
  factions.value = factionsData
  ensureDocumentReturnContext(data)
}

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && documentItem.value) {
    editableDocument.value = documentFormPayload(documentItem.value)
  }
})

function documentFormPayload(document) {
  return {
    ...document,
    content: document.content || '',
    documentUrl: document.documentUrl || '',
    characterId: document.characterId || document.character?.id || '',
    characterIds: document.characterIds || document.characters?.map((character) => character.id) || [],
    factionIds: document.factionIds || document.factions?.map((faction) => faction.id) || []
  }
}

function startEdit() {
  editableDocument.value = documentFormPayload(documentItem.value)
  isEditing.value = true
  router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
  isEditing.value = false
  editableDocument.value = documentItem.value ? documentFormPayload(documentItem.value) : null
  const query = { ...route.query }
  delete query.edit
  router.replace({ path: route.path, query })
}

async function saveDocument() {
  if (!editableDocument.value?.id) return

  const updatedDocument = await useApiFetch(`/api/documents/${editableDocument.value.id}`, {
    method: 'PUT',
    body: editableDocument.value
  })

  documentItem.value = updatedDocument
  editableDocument.value = documentFormPayload(updatedDocument)
  if (updatedDocument?.slug && updatedDocument.slug !== route.params.id) {
    const query = { ...route.query }
    delete query.edit
    await router.replace({
      path: `/documents/${updatedDocument.slug}`,
      query
    })
    isEditing.value = false
    return
  }

  cancelEdit()
}

function readDocumentReturnContext() {
  if (!import.meta.client) return null

  try {
    const raw = sessionStorage.getItem('limbus:document-return-context')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function ensureDocumentReturnContext(documentData) {
  const storedContext = readDocumentReturnContext()
  returnContext.value = storedContext?.documentId === documentData?.id ? storedContext : null
  if (returnContext.value || !import.meta.client || !documentData?.id) return

  const fallbackContext = { source: 'documents', documentId: documentData.id }
  returnContext.value = fallbackContext
  sessionStorage.setItem('limbus:document-return-context', JSON.stringify(fallbackContext))
}

onMounted(loadData)
</script>
