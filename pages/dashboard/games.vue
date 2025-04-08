<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Jeux</h1>

    <div class="flex flex-col md:flex-row justify-between gap-4 mb-4">
      <UInput v-model="searchQuery" placeholder="Rechercher un jeu..." icon="i-heroicons-magnifying-glass"
        class="flex-1" />
      <USelect v-model="sortOption" :options="sortOptions" option-attribute="label" value-attribute="value"
        class="w-full md:w-60" />
    </div>


    <UCard v-for="game in filteredGames" :key="game.id" class="mb-4">
      <template #header>
        <div class="flex justify-between items-center">
          <div>
            <strong>{{ game.title }}</strong> — <code>{{ game.slug }}</code>
          </div>
          <div class="flex gap-2">
            <UButton size="xs" color="blue" @click="startEdit(game)">Modifier</UButton>
            <UButton size="xs" color="red" @click="deleteGame(game.id)">Supprimer</UButton>
          </div>
        </div>
      </template>
      <p>{{ game.description }}</p>
    </UCard>

    <GameForm v-model:game="newGame" mode="create" @submit="createGame" />

    <GameForm v-if="editingGame" v-model:game="editingGame" mode="edit" @submit="saveEdit" @cancel="cancelEdit" />

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
//import { z } from 'zod'
//import { useForm } from '#imports' // si tu utilises vee-validate ou une lib similaire, à adapter

const games = ref([])
const editingGame = ref(null)

const fetchGames = async () => {
  games.value = await $fetch('/api/games')
}

onMounted(fetchGames)

// Création d'un jeu vierge (à réutiliser à plusieurs endroits)
const emptyGame = () => ({
  title: '',
  description: '',
  teaserUrl: '',
  noteIntention: ''
})

// Création d'un nouveau jeu
const newGame = ref(emptyGame())

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

// Edition d'un jeu existant
const startEdit = (game) => {
  editingGame.value = { ...game }
}

const saveEdit = async () => {
  if (!editingGame.value?.id) return

  try {
    await $fetch(`/api/games/${editingGame.value.id}`, {
      method: 'PUT',
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
      await $fetch(`/api/games/${id}`, { method: 'DELETE' })
      await fetchGames()
    } catch (error) {
      console.error('Erreur lors de la suppression du jeu', error)
    }
  }
}

//Recherche
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