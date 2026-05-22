<template>
  <UCard>
    <template #header>
      {{ mode === 'edit' ? 'Modifier la session' : 'Créer une session' }}
    </template>

    <form @submit.prevent="submit" class="space-y-4">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localSession.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
        />
      </UFormField>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localSession.name" required />
      </UFormField>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UFormField label="Date">
          <UInput v-model="localSession.date" type="datetime-local" />
        </UFormField>

        <UFormField label="Lieu">
          <USelect
            v-model="localSession.locationId"
            :items="locationOptions"
            value-key="value"
            placeholder="Choisissez un lieu"
          />
        </UFormField>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Cast</h3>
          <UButton type="button" size="xs" icon="i-heroicons-plus" @click="addAssignment">
            Ajouter
          </UButton>
        </div>

        <div
          v-for="(assignment, index) in localSession.assignments"
          :key="index"
          class="grid grid-cols-1 md:grid-cols-12 gap-2 items-start rounded border border-gray-200 p-3"
        >
          <USelect
            v-model="assignment.characterId"
            :items="characterOptions"
            value-key="value"
            placeholder="Personnage"
            class="md:col-span-3"
          />
          <USelect
            v-model="assignment.playerId"
            :items="playerOptions"
            value-key="value"
            placeholder="Joueur"
            class="md:col-span-3"
          />
          <div class="md:col-span-3 flex items-center gap-2">
            <UAvatar :src="assignment.photoUrl || undefined" icon="i-heroicons-camera" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="block w-full text-xs"
              :disabled="uploadingIndex === index"
              @change="uploadAssignmentPhoto($event, assignment, index)"
            >
          </div>
          <UInput v-model="assignment.notes" placeholder="Notes" class="md:col-span-2" />
          <UButton
            type="button"
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            class="md:col-span-1"
            @click="removeAssignment(index)"
          />
        </div>
      </div>

      <div class="flex gap-2">
        <UButton type="submit" color="primary">
          {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
        </UButton>
        <UButton type="button" color="neutral" @click="$emit('cancel')">
          Annuler
        </UButton>
      </div>

      <p v-if="serverError" class="text-red-500 text-sm mt-2">{{ serverError }}</p>
    </form>
  </UCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  session: { type: Object, required: true },
  games: { type: Array, required: true },
  characters: { type: Array, required: true },
  locations: { type: Array, required: true },
  players: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:session'])

const localSession = ref({ ...props.session })
const errors = ref({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const characterOptions = computed(() => props.characters
  .filter((character) => !localSession.value.gameId || character.gameId === localSession.value.gameId)
  .map((character) => ({
    label: character.name,
    value: character.id
  })))

const locationOptions = computed(() => [
  { label: 'Aucun lieu', value: '' },
  ...props.locations
    .filter((location) => !localSession.value.gameId || location.gameId === localSession.value.gameId)
    .map((location) => ({
      label: location.address ? `${location.name} - ${location.address}` : location.name,
      value: location.id
    }))
])

const playerOptions = computed(() => [
  { label: 'Aucun joueur', value: '' },
  ...props.players
    .filter((player) => !localSession.value.gameId || player.games?.some((game) => game.id === localSession.value.gameId))
    .map((player) => ({
      label: player.email ? `${player.name} - ${player.email}` : player.name,
      value: player.id
    }))
])

watch(() => props.session, (newSession) => {
  localSession.value = {
    ...newSession,
    assignments: newSession.assignments?.map((assignment) => ({
      characterId: assignment.characterId || assignment.character?.id || '',
      playerId: assignment.playerId || assignment.player?.id || '',
      photoUrl: assignment.photoUrl || '',
      notes: assignment.notes || ''
    })) || []
  }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localSession.value.gameId, () => {
  localSession.value.assignments = localSession.value.assignments?.filter((assignment) =>
    props.characters.some((character) => character.id === assignment.characterId && character.gameId === localSession.value.gameId)
  ) || []
})

function addAssignment() {
  localSession.value.assignments.push({
    characterId: '',
    playerId: '',
    photoUrl: '',
    notes: ''
  })
}

function removeAssignment(index) {
  localSession.value.assignments.splice(index, 1)
}

function validate() {
  errors.value = {}
  if (!localSession.value.name?.trim()) {
    errors.value.name = 'Le nom est requis.'
  }
  if (!localSession.value.gameId) {
    errors.value.gameId = 'Le jeu est requis.'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:session', {
      ...localSession.value,
      assignments: localSession.value.assignments.filter((assignment) => assignment.characterId)
    })
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}

const uploadingIndex = ref(null)

async function uploadAssignmentPhoto(event, assignment, index) {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return

  uploadingIndex.value = index
  try {
    const formData = new FormData()
    formData.append('photo', file)
    const result = await useApiFetch('/api/uploads/session-assignment-photos', {
      method: 'POST',
      body: formData
    })
    assignment.photoUrl = result.photoUrl
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Impossible d’envoyer la photo'
  } finally {
    uploadingIndex.value = null
    input.value = ''
  }
}
</script>
