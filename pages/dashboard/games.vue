<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Jeux</h1>

    <UCard class="mb-6">
      <template #header>Créer un nouveau jeu</template>
      <template #default>
        <form @submit.prevent="createGame" class="space-y-4">
          <UInput v-model="newGame.title" label="Titre" required />
          <UTextarea v-model="newGame.description" label="Description" />
          <UInput v-model="newGame.teaserUrl" label="URL du teaser vidéo" />
          <UTextarea v-model="newGame.noteIntention" label="Note d’intention" />
          <UButton type="submit">Créer</UButton>
        </form>
      </template>
    </UCard>

    <UCard v-for="game in games" :key="game.id" class="mb-4">
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
      <template #default>
        <p>{{ game.description }}</p>
      </template>
    </UCard>

    <UCard v-if="editingGame" class="mt-6">
      <template #header>Modifier le jeu</template>
      <template #default>
        <form @submit.prevent="saveEdit" class="space-y-4">
          <UInput v-model="editingGame.title" label="Titre" />
          <UTextarea v-model="editingGame.description" label="Description" />
          <UInput v-model="editingGame.teaserUrl" label="URL du teaser" />
          <UTextarea v-model="editingGame.noteIntention" label="Note d’intention" />
          <div class="flex gap-2">
            <UButton type="submit" color="blue">Enregistrer</UButton>
            <UButton @click="editingGame = null" color="gray">Annuler</UButton>
          </div>
        </form>
      </template>
    </UCard>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const games = ref([])
const newGame = ref({
  title: '',
  description: '',
  teaserUrl: '',
  noteIntention: ''
})

const fetchGames = async () => {
  games.value = await $fetch('/api/games')
}

const createGame = async () => {
  await $fetch('/api/games', {
    method: 'POST',
    body: newGame.value
  })

  newGame.value = { title: '', description: '', teaserUrl: '', noteIntention: '' }
  await fetchGames()
}

const editingGame = ref(null)

const startEdit = (game) => {
  editingGame.value = { ...game }
}

const saveEdit = async () => {
  await $fetch(`/api/games/${editingGame.value.id}`, {
    method: 'PUT',
    body: editingGame.value
  })

  editingGame.value = null
  await fetchGames()
}

const deleteGame = async (id) => {
  if (confirm('Supprimer ce jeu ?')) {
    await $fetch(`/api/games/${id}`, { method: 'DELETE' })
    await fetchGames()
  }
}

onMounted(fetchGames)
</script>