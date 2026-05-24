<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Jeux</h1>

    <GameContextBar />

    <div class="flex justify-end mb-4">
      <UButton icon="i-heroicons-plus" @click="startCreate" color="primary">
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
      <div class="text-sm text-gray-500">
        Triés par dernière activité
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <UCard
        v-for="game in paginatedGames"
        :key="game.id"
        class="cursor-pointer transition-shadow hover:shadow-md"
        :class="{ 'opacity-60': !game.published }"
        role="link"
        tabindex="0"
        @click="openGamePage(game)"
        @keydown.enter="openGamePage(game)"
      >
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-2">
              <h2 class="text-lg font-semibold leading-tight">
                {{ game.title }}
              </h2>
              <div class="flex flex-wrap gap-1">
                <UBadge v-if="activeGame?.id === game.id" color="success" variant="subtle" size="xs">
                  Jeu actif
                </UBadge>
                <UBadge v-if="!game.published" color="neutral" variant="solid" size="xs">
                  Archivé
                </UBadge>
                <UBadge v-if="game.publicPage" color="primary" variant="subtle" size="xs">
                  Publié
                </UBadge>
              </div>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm leading-6 text-gray-600 line-clamp-4">
            {{ excerpt(game.description, 220) || 'Aucune description renseignée.' }}
          </p>

          <div v-if="game.noteIntention" class="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
            <div class="mb-1 font-medium text-gray-700">Note d’intention</div>
            <p class="line-clamp-3">{{ excerpt(game.noteIntention, 160) }}</p>
          </div>

          <div class="flex flex-wrap gap-2 pt-1">
            <template v-if="activeGame?.id !== game.id">
              <UButton
                v-if="!game.published"
                icon="i-heroicons-arrow-up-tray"
                size="xs"
                color="warning"
                @click.stop="publishGame(game.id)"
              >
                Restaurer
              </UButton>
              <UButton
                v-else
                icon="i-heroicons-check-circle"
                size="xs"
                color="success"
                @click.stop="selectGame({ id: game.id, title: game.title })"
              >
                Rendre actif
              </UButton>
            </template>

            <UButton
              icon="i-heroicons-pencil-square"
              size="xs"
              color="primary"
              @click.stop="startEdit(game)"
            >
              Modifier
            </UButton>

            <UButton
              v-if="game.published"
              :icon="game.publicPage ? 'i-heroicons-eye-slash' : 'i-heroicons-globe-alt'"
              size="xs"
              :color="game.publicPage ? 'neutral' : 'primary'"
              variant="soft"
              @click.stop="setPublicPage(game, !game.publicPage)"
            >
              {{ game.publicPage ? 'Dépublier' : 'Publier' }}
            </UButton>

            <UButton
              v-if="game.published"
              icon="i-heroicons-archive-box"
              size="xs"
              color="error"
              variant="soft"
              @click.stop="archiveGame(game.id)"
            >
              Archiver
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
  </div>

  <!-- Slideover formulaire -->
  <AppWideSlideover
    v-model:open="showFormSlideover"
    :title="formMode === 'edit' ? 'Modifier le jeu' : 'Créer un jeu'"
    :full-page-to="formMode === 'edit' && activeFormGame?.slug ? `/games/${activeFormGame.slug}?edit=1` : null"
    @close="closeFormSlideover"
    @full-page="showFormSlideover = false"
  >
    <GameForm
      v-if="activeFormGame"
      v-model:game="activeFormGame"
      :mode="formMode"
      @submit="handleGameFormSubmit"
      @cancel="closeFormSlideover"
    />
  </AppWideSlideover>

</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameFocus } from '@/composables/useGameFocus'
import GameContextBar from '@/components/GameContextBar.vue'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const { selectGame, game: activeGame } = useGameFocus()

const games = ref([])
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
    publicPage: false,
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
const showArchived = ref(false)

const filteredGames = computed(() => {
  let result = games.value.filter(game =>
    [game.title, game.description].some(field =>
      field?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  )

  if (!showArchived.value) {
    result = result.filter(game => game.published)
  }

  result.sort((a, b) => new Date(b.lastActivityAt || b.updatedAt).getTime() - new Date(a.lastActivityAt || a.updatedAt).getTime())

  return result
})

const page = ref(1)
const itemsPerPage = 5

const paginatedGames = computed(() => {
  const start = (page.value - 1) * itemsPerPage
  return filteredGames.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredGames.value.length / itemsPerPage)))

const nextPage = () => {
  if (page.value < totalPages.value) page.value++
}

const prevPage = () => {
  if (page.value > 1) page.value--
}

const excerpt = (value, maxLength) => {
  const text = value?.trim()
  if (!text) return ''
  if (text.length <= maxLength) return text

  return `${text.slice(0, maxLength).trimEnd()}...`
}

const showFormSlideover = ref(false)
const activeFormGame = ref(null)
const formMode = ref('create')

function closeFormSlideover() {
  activeFormGame.value = null
  showFormSlideover.value = false
  if (route.query.edit) {
    const query = { ...route.query }
    delete query.edit
    router.replace({ path: route.path, query })
  }
}

function openGamePage(game) {
  if (!game?.slug) return
  router.push(`/games/${game.slug}`)
}

async function setPublicPage(game, publicPage) {
  await useApiFetch(`/api/games/${game.id}`, {
    method: 'PUT',
    body: { publicPage }
  })
  await fetchGames()
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

  startEdit(game)
}, { immediate: true })

</script>
