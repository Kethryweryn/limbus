<template>
  <div v-if="participant" class="p-6 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/participants" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Participants
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

    <ParticipantForm
      v-if="isEditing"
      v-model:participant="editableParticipant"
      :games="games || []"
      mode="edit"
      @submit="saveParticipant"
      @cancel="cancelEdit"
    />

    <template v-else>
      <h1 class="text-3xl font-bold">{{ participant.name }}</h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UCard>
          <template #header>Coordonnées</template>
          <div class="space-y-3 text-sm">
            <div>
              <span class="text-gray-500">Email</span>
              <div>{{ participant.email || 'Non renseigné' }}</div>
            </div>
            <div>
              <span class="text-gray-500">Téléphone</span>
              <div>{{ participant.phone || 'Non renseigné' }}</div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>Jeux</template>
          <div class="flex flex-wrap gap-2">
            <UBadge v-for="game in participant.games" :key="game.id" color="neutral" variant="subtle">
              {{ game.title }}
            </UBadge>
            <span v-if="!participant.games?.length" class="text-sm text-gray-500">Aucun jeu</span>
          </div>
        </UCard>
      </div>

      <div v-if="participant.notes">
        <h2 class="text-xl font-semibold mb-2">Notes</h2>
        <p class="whitespace-pre-line">{{ participant.notes }}</p>
      </div>
    </template>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const { data: participant, error, refresh } = await useFetch(`/api/participants/${route.params.id}`)
const { data: games } = await useFetch('/api/games')

if (error.value) {
  handleApiAuthError(error.value)
  throw createError({ statusCode: error.value.statusCode || 404, message: 'Participant introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editableParticipant = ref(participant.value ? normalizeParticipantForForm(participant.value) : null)

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && participant.value) {
    editableParticipant.value = normalizeParticipantForForm(participant.value)
  }
})

function normalizeParticipantForForm(value) {
  return {
    ...value,
    gameIds: value.games?.map((game) => game.id) || []
  }
}

function startEdit() {
  editableParticipant.value = normalizeParticipantForForm(participant.value)
  isEditing.value = true
  router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
  isEditing.value = false
  editableParticipant.value = participant.value ? normalizeParticipantForForm(participant.value) : null
  const query = { ...route.query }
  delete query.edit
  router.replace({ path: route.path, query })
}

async function saveParticipant() {
  if (!editableParticipant.value?.id) return

  participant.value = await useApiFetch(`/api/participants/${editableParticipant.value.id}`, {
    method: 'PUT',
    body: editableParticipant.value
  })
  await refresh()
  cancelEdit()
}
</script>



