<template>
  <div v-if="player" class="p-6 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/players" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Joueurs
      </UButton>
      <UButton
        v-if="!isEditing"
        icon="i-heroicons-pencil-square"
        color="primary"
        @click="startEdit"
      >
        Modifier
      </UButton>
    </div>

    <PlayerForm
      v-if="isEditing"
      v-model:player="editablePlayer"
      :games="games || []"
      mode="edit"
      @submit="savePlayer"
      @cancel="cancelEdit"
    />

    <template v-else>
      <h1 class="text-3xl font-bold">{{ player.name }}</h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UCard>
          <template #header>Coordonnées</template>
          <div class="space-y-3 text-sm">
            <div>
              <span class="text-gray-500">Email</span>
              <div>{{ player.email || 'Non renseigné' }}</div>
            </div>
            <div>
              <span class="text-gray-500">Téléphone</span>
              <div>{{ player.phone || 'Non renseigné' }}</div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>Jeux</template>
          <div class="flex flex-wrap gap-2">
            <UBadge v-for="game in player.games" :key="game.id" color="neutral" variant="subtle">
              {{ game.title }}
            </UBadge>
            <span v-if="!player.games?.length" class="text-sm text-gray-500">Aucun jeu</span>
          </div>
        </UCard>
      </div>

      <div v-if="player.notes">
        <h2 class="text-xl font-semibold mb-2">Notes</h2>
        <p class="whitespace-pre-line">{{ player.notes }}</p>
      </div>
    </template>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const { data: player, error, refresh } = await useFetch(`/api/players/${route.params.id}`)
const { data: games } = await useFetch('/api/games')

if (error.value) {
  handleApiAuthError(error.value)
  throw createError({ statusCode: error.value.statusCode || 404, message: 'Joueur introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editablePlayer = ref(player.value ? normalizePlayerForForm(player.value) : null)

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && player.value) {
    editablePlayer.value = normalizePlayerForForm(player.value)
  }
})

function normalizePlayerForForm(value) {
  return {
    ...value,
    gameIds: value.games?.map((game) => game.id) || []
  }
}

function startEdit() {
  editablePlayer.value = normalizePlayerForForm(player.value)
  isEditing.value = true
  router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
  isEditing.value = false
  editablePlayer.value = player.value ? normalizePlayerForForm(player.value) : null
  const query = { ...route.query }
  delete query.edit
  router.replace({ path: route.path, query })
}

async function savePlayer() {
  if (!editablePlayer.value?.id) return

  player.value = await useApiFetch(`/api/players/${editablePlayer.value.id}`, {
    method: 'PUT',
    body: editablePlayer.value
  })
  await refresh()
  cancelEdit()
}
</script>
