<template>
  <div v-if="location" class="p-6 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/locations" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Lieux
      </UButton>
      <div class="flex flex-wrap items-start gap-2">
        <UButton
          v-if="!isEditing"
          icon="i-heroicons-pencil-square"
          color="primary"
          @click="startEdit"
        >
          Modifier
        </UButton>
        <SheetDeleteButton :url="`/api/locations/${location.id}`" :confirm-text="DELETE_CONFIRMATIONS.location" list-path="/locations" />
      </div>
    </div>

    <LocationForm
      v-if="isEditing && editableLocation"
      v-model:location="editableLocation"
      :games="games || []"
      mode="edit"
      @submit="saveLocation"
      @cancel="cancelEdit"
    />

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-3xl font-bold">{{ location.name }}</h1>
        <UBadge v-if="isInArchivedGame(location)" color="neutral" variant="solid">
          Archivé
        </UBadge>
      </div>

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

<script setup lang="ts">
import { DELETE_CONFIRMATIONS } from '~/utils/deleteConfirmations'
import { pageLoadError } from '~/utils/apiErrors'
import { isInArchivedGame } from '~/utils/games'
import { withQueuedEdit, type LocationDraft } from '~/utils/writingDrafts'

const route = useRoute()
const { data: location, error, refresh } = await useFetch(`/api/locations/slug/${route.params.slug}`)
const { data: games } = await useFetch('/api/games')

if (error.value) {
  handleApiAuthError(error.value)
  throw pageLoadError(error.value, 'Lieu introuvable')
}

const { isEditing, draft: editableLocation, startEdit, cancelEdit, closeAfterSave } = useSheetEdit<LocationDraft>(() => location.value ? { ...location.value } : null)

async function saveLocation() {
  if (!editableLocation.value?.id) return

  const updated = await useApiFetch(`/api/locations/${editableLocation.value.id}`, {
    method: 'PUT',
    body: editableLocation.value
  })
  if (isOfflineQueued(updated)) {
    if (location.value) location.value = withQueuedEdit(location.value, editableLocation.value)
    cancelEdit()
    return
  }
  location.value = updated
  await closeAfterSave(`/locations/${updated.slug}`, refresh)
}
</script>
