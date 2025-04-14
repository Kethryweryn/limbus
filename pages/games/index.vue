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
      <USelect v-model="sortOption" :options="sortOptions" option-attribute="label" value-attribute="value"
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
              <UBadge color="green" variant="solid" size="xs">🎯 Jeu actif</UBadge>
            </template>
            <template v-else>
              <UButton v-if="!game.published && !isOffline" @click="publishGame(game.id)" size="xs" color="orange">
                Publier
              </UButton>
              <UButton v-else @click="selectGame({ id: game.id, title: game.title })" size="xs" color="green">
                Définir comme jeu actif
              </UButton>
            </template>

            <UButton v-if="!isOffline" size="xs" color="blue" @click="startEdit(game)">Modifier</UButton>

            <template v-if="!game.published">
              <UBadge color="gray" variant="solid" size="xs">Archivé</UBadge>
            </template>
            <template v-else-if="!isOffline">
              <UButton size="xs" color="red" @click="archiveGame(game.id)">Archiver</UButton>
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
  <USlideover v-model="showFormSlideover">
    <div class="p-4 space-y-4">
      <GameForm v-if="activeFormGame" v-model:game="activeFormGame" :mode="formMode" @submit="handleGameFormSubmit"
        @cancel="closeFormSlideover" />
    </div>
  </USlideover>

  <!-- Slideover aperçu -->
  <USlideover v-model="showPreviewSlideover">
    <div class="p-4 space-y-4">
      <h2 class="text-xl font-bold">{{ selectedGame?.title }}</h2>
      <p>{{ selectedGame?.description }}</p>
      <p class="text-sm text-gray-500">{{ selectedGame?.noteIntention }}</p>

      <div class="mt-4">
        <UButton :to="`/games/${selectedGame?.slug}`" color="gray" variant="ghost">
          Voir la page complète
        </UButton>
      </div>

      <UButton @click="selectGame({ id: selectedGame.id, title: selectedGame.title })" size="sm" color="green">
        Utiliser ce jeu
      </UButton>
    </div>
  </USlideover>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameFocus } from '@/composables/useGameFocus'
import GameContextBar from '@/components/GameContextBar.vue'
import { getFromStore, saveToStore } from '~/utils/storage'

const { selectGame, game: activeGame } = useGameFocus()

const games = ref([])
const selectedGame = ref(null)

const fetchGames = async () => {
  if (!navigator.onLine) {
    games.value = await getFromStore('games', 'list') || []
    return
  }

  try {
    const data = await $fetch('/api/games')
    games.value = data
    await saveToStore('games', 'list', data)
  } catch (err) {
    console.error('[games] erreur API', err)
    games.value = []
  }
}

const isOffline = ref(false)
const updateStatus = () => {
  isOffline.value = !navigator.onLine
}

onMounted(() => {
  updateStatus()
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
  fetchGames()
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
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
    await $fetch(`/api/games/${id}/put`, {
      method: 'POST',
      body: { published: false }
    })
    await fetchGames()
  }
}

const publishGame = async (id) => {
  try {
    await $fetch(`/api/games/${id}/put`, {
      method: 'POST',
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

function closeFormSlideover() {
  activeFormGame.value = null
  showFormSlideover.value = false
}

function openSlideover(slug) {
  selectedGame.value = games.value.find(g => g.slug === slug)
  showPreviewSlideover.value = true
}

async function handleGameFormSubmit() {
  try {
    if (formMode.value === 'create') {
      await $fetch('/api/games', {
        method: 'POST',
        body: activeFormGame.value
      })
    } else if (formMode.value === 'edit') {
      await $fetch(`/api/games/${activeFormGame.value.id}/put`, {
        method: 'POST',
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

</script>