<template>
  <div v-if="location" class="p-6 max-w-4xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/locations" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Lieux
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

    <LocationForm
      v-if="isEditing"
      v-model:location="editableLocation"
      :games="games || []"
      mode="edit"
      @submit="saveLocation"
      @cancel="cancelEdit"
    />

    <template v-else>
      <h1 class="text-3xl font-bold">{{ location.name }}</h1>

      <UCard>
        <template #header>Détails du lieu</template>
        <div class="space-y-4">
          <div>
            <span class="text-sm text-gray-500">Jeu</span>
            <div>{{ location.game?.title || 'Jeu inconnu' }}</div>
          </div>
          <div v-if="location.address">
            <span class="text-sm text-gray-500">Adresse</span>
            <div class="whitespace-pre-line">{{ location.address }}</div>
          </div>
          <div v-if="location.notes">
            <span class="text-sm text-gray-500">Notes</span>
            <div class="whitespace-pre-line">{{ location.notes }}</div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const { data: location, error, refresh } = await useFetch(`/api/locations/${route.params.id}`)
const { data: games } = await useFetch('/api/games')

if (error.value) {
  handleApiAuthError(error.value)
  throw createError({ statusCode: error.value.statusCode || 404, message: 'Lieu introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editableLocation = ref(location.value ? { ...location.value } : null)

watch(() => route.query.edit, (value) => {
  isEditing.value = value === '1'
  if (isEditing.value && location.value) {
    editableLocation.value = { ...location.value }
  }
})

function startEdit() {
  editableLocation.value = { ...location.value }
  isEditing.value = true
  router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
  isEditing.value = false
  editableLocation.value = location.value ? { ...location.value } : null
  const query = { ...route.query }
  delete query.edit
  router.replace({ path: route.path, query })
}

async function saveLocation() {
  if (!editableLocation.value?.id) return

  location.value = await useApiFetch(`/api/locations/${editableLocation.value.id}`, {
    method: 'PUT',
    body: editableLocation.value
  })
  await refresh()
  cancelEdit()
}
</script>
