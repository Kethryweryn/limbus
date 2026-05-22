<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Jeux</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton icon="i-heroicons-plus" @click="startCreate" color="primary" v-if="!isOffline">
        Créer un jeu
      </UButton>
    </div>

    <div class="flex flex-col md:flex-row justify-between gap-4 mb-4">
      <div class="flex items-center gap-2">
        <UCheckbox v-model="showArchived" />
        <span class="text-sm text-gray-600">Afficher les archives</span>
      </div>

      <UInput v-model="searchQuery" placeholder="Rechercher un jeu..." icon="i-heroicons-magnifying-glass"
        class="flex-1" />
      <USelect v-model="sortOption" :items="sortOptions" value-key="value"
        class="w-full md:w-60" />
    </div>

    <UCard v-for="game in paginatedGames" :key="game.id" class="mb-4" :class="{ 'opacity-50': !game.published }">
      <template #header>
        <div class="flex justify-between items-center">
          <button class="text-blue-600 hover:underline" @click="openSlideover(game.slug)">
            {{ game.title }}
          </button>
          <div class="flex gap-2">
            <template v-if="activeGame?.id === game.id">
              <UBadge color="success" variant="solid" size="xs">🎯 Jeu actif</UBadge>
            </template>
            <template v-else>
              <UButton v-if="!game.published && !isOffline" @click="publishGame(game.id)" size="xs" color="warning">
                Publier
              </UButton>
              <UButton v-else @click="selectGame({ id: game.id, title: game.title })" size="xs" color="success">
                Définir comme jeu actif
              </UButton>
            </template>

            <UButton v-if="!isOffline" size="xs" color="primary" @click="startEdit(game)">Modifier</UButton>

            <template v-if="!game.published">
              <UBadge color="neutral" variant="solid" size="xs">Archivé</UBadge>
            </template>
            <template v-else-if="!isOffline">
              <UButton size="xs" color="error" @click="archiveGame(game.id)">Archiver</UButton>
            </template>
          </div>
        </div>
      </template>
    </UCard>

    <div class="flex justify-center gap-4 mt-6">
      <UButton @click="prevPage" :disabled="page === 1">← Précédent</UButton>
      <span class="text-sm text-gray-500">Page {{ page }} / {{ totalPages }}</span>
      <UButton @click="nextPage" :disabled="page === totalPages">Suivant →</UButton>
    </div>
  </div>

  <!-- Slideover formulaire -->
  <USlideover v-model:open="showFormSlideover" :ui="{ content: formSlideoverClass }">
    <template #header>
      <div class="flex w-full items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">
            {{ formMode === 'edit' ? 'Modifier le jeu' : 'Créer un jeu' }}
          </h2>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="formMode === 'edit' && activeFormGame?.slug"
            icon="i-heroicons-arrows-pointing-out"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="openFullPageEdit"
          >
            Pleine page
          </UButton>
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Fermer"
            @click="closeFormSlideover"
          />
        </div>
      </div>
    </template>
    <template #body>
    <div class="p-6 space-y-6">
      <GameForm v-if="activeFormGame" v-model:game="activeFormGame" :mode="formMode" @submit="handleGameFormSubmit"
        @cancel="closeFormSlideover" />
    </div>
    </template>
  </USlideover>

  <!-- Slideover aperçu -->
  <USlideover v-model:open="showPreviewSlideover" :ui="{ content: previewSlideoverClass }">
    <template #header>
      <div class="flex w-full items-center justify-between gap-3">
        <h2 class="truncate text-base font-semibold">{{ selectedGame?.title }}</h2>
        <div class="flex items-center gap-2">
          <UButton
            v-if="selectedGame?.slug"
            icon="i-heroicons-arrows-pointing-out"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="openFullPagePreview"
          >
            Pleine page
          </UButton>
          <UButton
            v-if="selectedGame && !isOffline"
            icon="i-heroicons-pencil-square"
            color="primary"
            variant="ghost"
            size="sm"
            @click="startEditFromPreview"
          >
            Modifier
          </UButton>
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Fermer"
            @click="showPreviewSlideover = false"
          />
        </div>
      </div>
    </template>
    <template #body>
    <div v-if="selectedGame" class="p-6 space-y-8">
      <div class="space-y-3">
        <h2 class="text-3xl font-bold">{{ selectedGame?.title }}</h2>
        <p class="text-base leading-7 text-gray-700 whitespace-pre-line">{{ selectedGame?.description }}</p>
      </div>

      <div v-if="selectedGame?.noteIntention" class="space-y-2">
        <h3 class="text-lg font-semibold">Note d’intention</h3>
        <p class="text-base leading-7 text-gray-700 whitespace-pre-line">{{ selectedGame?.noteIntention }}</p>
      </div>

      <UButton @click="selectGame({ id: selectedGame.id, title: selectedGame.title })" size="sm" color="success">
        Utiliser ce jeu
      </UButton>
    </div>
    </template>
  </USlideover>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameFocus } from '@/composables/useGameFocus'
import GameContextBar from '@/components/GameContextBar.vue'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const { selectGame, game: activeGame } = useGameFocus()

const games = ref([])
const selectedGame = ref(null)
const route = useRoute()
const router = useRouter()

const fetchGames = async () => {
  if (isOfflineMode()) {
    games.value = await getFromStore('games', 'list') || []
    return
  }

  try {
    const data = await useApiFetch('/api/games')
    games.value = data
    saveToStore('games', 'list', data)
  } catch (err) {
    console.error('[games] erreur API', err)
    games.value = []
  }
}

const isOffline = ref(false)
const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = isOfflineMode()
  if (wasOffline !== isOffline.value) {
    fetchGames()
  }
}

onMounted(() => {
  updateStatus()
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
  window.addEventListener('limbus:connection-change', updateStatus)
  fetchGames()
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
  window.removeEventListener('limbus:connection-change', updateStatus)
})


const startEdit = (game) => {
  activeFormGame.value = { ...game }
  formMode.value = 'edit'
  showFormSlideover.value = true
}

function startCreate() {
  activeFormGame.value = {
    title: '',
    description: '',
    noteIntention: '',
    published: false
  }
  formMode.value = 'create'
  showFormSlideover.value = true
}

const archiveGame = async (id) => {
  if (confirm('Archiver ce jeu ?')) {
    await useApiFetch(`/api/games/${id}`, {
      method: 'PUT',
      body: { published: false }
    })
    await fetchGames()
  }
}

const publishGame = async (id) => {
  try {
    await useApiFetch(`/api/games/${id}`, {
      method: 'PUT',
      body: { published: true }
    })
    await fetchGames()
  } catch (error) {
    console.error('Erreur lors de la publication du jeu', error)
  }
}

const searchQuery = ref('')
const sortOption = ref('title-asc')
const showArchived = ref(false)

const sortOptions = [
  { label: 'Titre A-Z', value: 'title-asc' },
  { label: 'Titre Z-A', value: 'title-desc' },
  { label: 'Plus récent', value: 'date-desc' },
  { label: 'Plus ancien', value: 'date-asc' }
]

const filteredGames = computed(() => {
  let result = games.value.filter(game =>
    [game.title, game.description].some(field =>
      field?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  )

  if (!showArchived.value) {
    result = result.filter(game => game.published)
  }

  switch (sortOption.value) {
    case 'title-asc':
      result.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'title-desc':
      result.sort((a, b) => b.title.localeCompare(a.title))
      break
    case 'date-desc':
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      break
    case 'date-asc':
      result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      break
  }

  return result
})

const page = ref(1)
const itemsPerPage = 5

const paginatedGames = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredGames.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(filteredGames.value.length / itemsPerPage))

const nextPage = () => {
  if (page.value < totalPages.value) page.value++
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

const showFormSlideover = ref(false)
const showPreviewSlideover = ref(false)
const activeFormGame = ref(null)
const formMode = ref('create')

const formSlideoverClass = 'w-screen max-w-none md:w-[calc(100vw-var(--limbus-sidebar-width,16rem))] md:max-w-none'
const previewSlideoverClass = formSlideoverClass

function closeFormSlideover() {
  activeFormGame.value = null
  showFormSlideover.value = false
  if (route.query.edit) {
    const query = { ...route.query }
    delete query.edit
    router.replace({ path: route.path, query })
  }
}

function openSlideover(slug) {
  selectedGame.value = games.value.find(g => g.slug === slug)
  showPreviewSlideover.value = true
}

function startEditFromPreview() {
  if (!selectedGame.value) return
  startEdit(selectedGame.value)
  showPreviewSlideover.value = false
}

function openFullPagePreview() {
  if (!selectedGame.value?.slug) return
  showPreviewSlideover.value = false
  router.push(`/games/${selectedGame.value.slug}`)
}

function openFullPageEdit() {
  if (!activeFormGame.value?.slug) return
  showFormSlideover.value = false
  router.push(`/games/${activeFormGame.value.slug}?edit=1`)
}

async function handleGameFormSubmit() {
  try {
    if (formMode.value === 'create') {
      await useApiFetch('/api/games', {
        method: 'POST',
        body: activeFormGame.value
      })
    } else if (formMode.value === 'edit') {
      await useApiFetch(`/api/games/${activeFormGame.value.id}`, {
        method: 'PUT',
        body: activeFormGame.value
      })
    }
    closeFormSlideover()
    await fetchGames()
  } catch (error) {
    console.error('Erreur lors de la soumission du formulaire de jeu', error)
  }
}

watch([searchQuery, filteredGames], () => {
  page.value = 1
})

watch([games, () => route.query.edit], () => {
  const editSlug = route.query.edit
  if (typeof editSlug !== 'string' || !editSlug) return

  const game = games.value.find(item => item.slug === editSlug)
  if (!game || activeFormGame.value?.slug === editSlug) return

  showPreviewSlideover.value = false
  startEdit(game)
}, { immediate: true })

</script>
