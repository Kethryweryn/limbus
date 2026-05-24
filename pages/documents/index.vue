<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Documents</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton icon="i-heroicons-plus" color="primary" @click="startCreate">
        Créer un document
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un document..." icon="i-heroicons-magnifying-glass" />
      <USelect
        v-if="!selectedGame"
        v-model="gameFilter"
        :items="gameFilterOptions"
        value-key="value"
        class="w-full md:w-64"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard v-for="document in paginatedDocuments" :key="document.id">
        <template #header>
          <div class="space-y-2">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-lg font-semibold leading-tight">{{ document.title }}</h2>
              <UBadge v-if="!hasTargets(document)" color="warning" variant="soft" size="xs">
                Non ciblé
              </UBadge>
            </div>
            <div class="flex flex-wrap gap-1">
              <UBadge color="neutral" variant="subtle" size="xs">
                {{ document.game?.title || 'Jeu inconnu' }}
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
        </template>

        <div class="space-y-4">
          <p class="text-sm leading-6 text-gray-600 line-clamp-4">
            {{ document.content || document.documentUrl || 'Aucun contenu renseigné.' }}
          </p>

          <div class="flex flex-wrap gap-1">
            <UBadge v-if="document.character" color="neutral" variant="subtle" size="xs" class="max-w-44 truncate">
              {{ document.character.name }}
            </UBadge>
            <UBadge
              v-for="character in document.characters || []"
              :key="character.id"
              color="neutral"
              variant="subtle"
              size="xs"
              class="max-w-44 truncate"
            >
              {{ character.name }}
            </UBadge>
            <UBadge
              v-for="faction in document.factions || []"
              :key="faction.id"
              color="warning"
              variant="subtle"
              size="xs"
              class="max-w-44 truncate"
            >
              {{ faction.name }}
            </UBadge>
          </div>

          <div class="flex flex-wrap gap-2 pt-1">
            <UButton icon="i-heroicons-pencil-square" size="xs" color="primary" @click="startEdit(document)">
              Modifier
            </UButton>
            <UButton icon="i-heroicons-trash" size="xs" color="error" variant="soft" @click="deleteDocument(document.id)">
              Supprimer
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <div class="flex items-center justify-center gap-4 mt-6">
      <UButton @click="prevPage" :disabled="page === 1">← Précédent</UButton>
      <span class="inline-flex items-center text-sm text-gray-500">Page {{ page }} / {{ totalPages }}</span>
      <UButton @click="nextPage" :disabled="page === totalPages">Suivant →</UButton>
    </div>

    <AppWideSlideover
      v-model:open="showFormSlideover"
      :title="formMode === 'edit' ? 'Modifier le document' : 'Créer un document'"
      @close="closeFormSlideover"
    >
      <DocumentForm
        v-if="activeFormDocument"
        v-model:document="activeFormDocument"
        :games="games"
        :characters="characters"
        :factions="factions"
        :mode="formMode"
        @submit="handleDocumentFormSubmit"
        @cancel="closeFormSlideover"
      />
    </AppWideSlideover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import DocumentForm from '@/components/DocumentForm.vue'
import GameContextBar from '@/components/GameContextBar.vue'
import { useGameFocus } from '@/composables/useGameFocus'
import { isOfflineMode } from '~/utils/connection'
import { DOCUMENT_AUDIENCES, DOCUMENT_AUDIENCE_LABELS } from '~/utils/domain'
import { getFromStore, saveToStore } from '~/utils/storage'

const documents = ref([])
const games = ref([])
const characters = ref([])
const factions = ref([])
const searchQuery = ref('')
const gameFilter = ref('all')
const isOffline = ref(false)
const showFormSlideover = ref(false)
const activeFormDocument = ref(null)
const formMode = ref('create')
const { game: selectedGame } = useGameFocus()

const page = ref(1)
const itemsPerPage = 9

const gameFilterOptions = computed(() => [
  { label: 'Tous les jeux', value: 'all' },
  ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const filteredDocuments = computed(() => {
  const term = searchQuery.value.toLowerCase()
  const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

  return documents.value
    .filter((document) => !gameId || document.gameId === gameId)
    .filter((document) =>
      [
        document.title,
        document.content,
        document.documentUrl,
        document.game?.title,
        document.character?.name,
        ...(document.characters || []).map((character) => character.name),
        ...(document.factions || []).map((faction) => faction.name)
      ].some((field) => field?.toLowerCase().includes(term))
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
})

const paginatedDocuments = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredDocuments.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredDocuments.value.length / itemsPerPage)))

watch([searchQuery, gameFilter, filteredDocuments], () => {
  page.value = 1
})

const nextPage = () => {
  if (page.value < totalPages.value) page.value++
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

const hasTargets = (document) =>
  document.audience !== DOCUMENT_AUDIENCES.targeted
  || Boolean(document.character || document.characters?.length || document.factions?.length)
const audienceLabel = (audience) => DOCUMENT_AUDIENCE_LABELS[audience] || DOCUMENT_AUDIENCE_LABELS[DOCUMENT_AUDIENCES.targeted]

const fetchDocuments = async () => {
  if (isOfflineMode()) {
    documents.value = await getFromStore('documents', 'list') || []
    return
  }

  const data = await useApiFetch('/api/documents')
  documents.value = data
  await saveToStore('documents', 'list', data)
}

const fetchGames = async () => {
  if (isOfflineMode()) {
    games.value = await getFromStore('games', 'list') || []
    return
  }

  const data = await useApiFetch('/api/games')
  games.value = data
  await saveToStore('games', 'list', data)
}

const fetchCharacters = async () => {
  if (isOfflineMode()) {
    characters.value = await getFromStore('characters', 'list') || []
    return
  }

  const data = await useApiFetch('/api/characters')
  characters.value = data
  await saveToStore('characters', 'list', data)
}

const fetchFactions = async () => {
  if (isOfflineMode()) {
    factions.value = await getFromStore('factions', 'list') || []
    return
  }

  const data = await useApiFetch('/api/factions')
  factions.value = data
  await saveToStore('factions', 'list', data)
}

const refreshData = async () => {
  await Promise.all([fetchDocuments(), fetchGames(), fetchCharacters(), fetchFactions()])
}

const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = isOfflineMode()

  if (wasOffline !== isOffline.value) {
    refreshData()
  }
}

onMounted(async () => {
  updateStatus()
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
  window.addEventListener('limbus:connection-change', updateStatus)
  await refreshData()
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
  window.removeEventListener('limbus:connection-change', updateStatus)
})

function documentFormPayload(document) {
  return {
    ...document,
    audience: document.audience || DOCUMENT_AUDIENCES.targeted,
    readyToSend: Boolean(document.readyToSend),
    content: document.content || '',
    documentUrl: document.documentUrl || '',
    characterId: document.characterId || document.character?.id || '',
    characterIds: document.characterIds || document.characters?.map((character) => character.id) || [],
    factionIds: document.factionIds || document.factions?.map((faction) => faction.id) || []
  }
}

function startCreate() {
  activeFormDocument.value = {
    title: '',
    audience: DOCUMENT_AUDIENCES.targeted,
    readyToSend: false,
    content: '',
    documentUrl: '',
    gameId: selectedGame.value?.id || games.value[0]?.id || '',
    characterId: '',
    characterIds: [],
    factionIds: [],
    published: true
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

function startEdit(document) {
  activeFormDocument.value = documentFormPayload(document)
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function closeFormSlideover() {
  activeFormDocument.value = null
  showFormSlideover.value = false
}

async function handleDocumentFormSubmit() {
  if (formMode.value === 'create') {
    await useApiFetch('/api/documents', {
      method: 'POST',
      body: activeFormDocument.value
    })
  } else {
    await useApiFetch(`/api/documents/${activeFormDocument.value.id}`, {
      method: 'PUT',
      body: activeFormDocument.value
    })
  }

  closeFormSlideover()
  await fetchDocuments()
}

async function deleteDocument(id) {
  if (!confirm('Supprimer ce document ?')) return

  await useApiFetch(`/api/documents/${id}`, { method: 'DELETE' })
  await fetchDocuments()
}
</script>
