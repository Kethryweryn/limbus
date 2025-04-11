<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Jeux</h1>

    <div class="flex flex-col md:flex-row justify-between gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un jeu..." icon="i-heroicons-magnifying-glass"
        class="flex-1" />
      <USelect v-model="sortOption" :options="sortOptions" option-attribute="label" value-attribute="value"
        class="w-full md:w-60" />
    </div>

    <GameForm v-if="editingGame" v-model:game="editingGame" mode="edit" @submit="saveEdit" @cancel="cancelEdit" />

    <UCard v-for="game in filteredGames" :key="game.id" class="mb-4">
      <template #header>
        <div class="flex justify-between items-center">
          <button class="text-blue-600 hover:underline" @click="openSlideover(game.slug)">
            {{ game.title }}
          </button>
          <div class="flex gap-2">
            <UButton @click="selectGame({ id: game.id, title: game.title })" size="xs" color="green">
              Définir comme jeu actif
            </UButton>
            <UButton size="xs" color="blue" @click="startEdit(game)">Modifier</UButton>
            <UButton size="xs" color="red" @click="deleteGame(game.id)">Supprimer</UButton>
          </div>
        </div>
      </template>
    </UCard>

    <GameForm v-model:game="newGame" mode="create" @submit="createGame" />

    <!-- Slideover -->
    <USlideover v-model="showSlideover">
      <div class="p-4 space-y-4">
        <h2 class="text-xl font-bold">{{ selectedGame?.title }}</h2>
        <p>{{ selectedGame?.description }}</p>
        <p class="text-sm text-gray-500">{{ selectedGame?.noteIntention }}</p>

        <div class="mt-4">
          <UButton :to="`/games/${selectedGame?.slug}`" color="gray" variant="ghost">
            Voir la page complète
          </UButton>
        </div>

        <!-- ✅ FIX ICI -->
        <UButton @click="selectGame({ id: selectedGame.id, title: selectedGame.title })" size="sm" color="green">
          Utiliser ce jeu
        </UButton>
      </div>
    </USlideover>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useGameFocus } from '@/composables/useGameFocus'

const { selectGame } = useGameFocus()

const games = ref([])
const editingGame = ref(null)
const newGame = ref(emptyGame())

const showSlideover = ref(false)
const selectedGame = ref(null)

const fetchGames = async () => {
  games.value = await $fetch('/api/games')
}

onMounted(fetchGames)

const openSlideover = async (slug) => {
  const data = await $fetch(`/api/games/${slug}`)
  selectedGame.value = data
  showSlideover.value = true
}

const closeSlideover = () => {
  showSlideover.value = false
  selectedGame.value = null
}

const emptyGame = () => ({
  title: '',
  description: '',
  teaserUrl: '',
  noteIntention: ''
})

const createGame = async () => {
  try {
    await $fetch('/api/games', {
      method: 'POST',
      body: newGame.value
    })
    newGame.value = emptyGame()
    await fetchGames()
  } catch (error) {
    console.error('Erreur lors de la création du jeu', error)
  }
}

const startEdit = (game) => {
  editingGame.value = { ...game }
}

const saveEdit = async () => {
  if (!editingGame.value?.id) return

  try {
    await $fetch(`/api/games/${editingGame.value.id}/put`, {
      method: 'POST',
      body: editingGame.value
    })
    editingGame.value = null
    await fetchGames()
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du jeu', error)
  }
}

const cancelEdit = () => {
  editingGame.value = null
}

const deleteGame = async (id) => {
  if (confirm('Supprimer ce jeu ?')) {
    try {
      await $fetch(`/api/games/${id}/delete`, { method: 'POST' })
      await fetchGames()
    } catch (error) {
      console.error('Erreur lors de la suppression du jeu', error)
    }
  }
}

const searchQuery = ref('')
const sortOption = ref('title-asc')

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
</script>