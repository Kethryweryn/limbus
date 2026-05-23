<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">Cast</h2>
          <p class="text-sm text-gray-500">{{ assignments.length }} personnage(s)</p>
        </div>
      </div>
    </template>

    <form @submit.prevent="submit" class="space-y-4">
      <div
        v-for="(assignment, index) in assignments"
        :key="index"
        class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start rounded border border-gray-200 p-3"
      >
        <div class="lg:col-span-3 min-w-0">
          <div class="flex items-center gap-2">
            <UBadge color="warning" variant="subtle" size="xs">
              {{ characterById(assignment.characterId)?.type === 'pnj' ? 'PNJ' : 'PJ' }}
            </UBadge>
            <span class="font-medium truncate">{{ characterById(assignment.characterId)?.name || 'Personnage inconnu' }}</span>
          </div>
          <p v-if="characterById(assignment.characterId)?.type === 'pnj'" class="mt-1 text-xs text-gray-500">
            Assignable uniquement à un organisateur ou PNJ de session.
          </p>
        </div>
        <USelect
          v-model="assignment.participantId"
          :items="participantOptionsForAssignment(assignment)"
          value-key="value"
          placeholder="Participant"
          class="lg:col-span-3"
        />
        <div class="lg:col-span-3 flex items-center gap-3">
          <button
            type="button"
            class="size-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center"
            :disabled="uploadingIndex === index"
            @click="assignment.photoUrl ? openPhotoPreview(assignment.photoUrl) : openFilePicker(index)"
          >
            <img
              v-if="assignment.photoUrl"
              :src="assignment.photoUrl"
              alt=""
              class="h-full w-full object-cover"
            >
            <UIcon v-else name="i-heroicons-camera" class="size-8 text-gray-400" />
          </button>

          <div class="min-w-0 space-y-1">
            <input
              :ref="(el) => setFileInputRef(el, index)"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              :disabled="uploadingIndex === index"
              @change="uploadAssignmentPhoto($event, assignment, index)"
            >
            <UButton
              type="button"
              size="xs"
              color="neutral"
              variant="subtle"
              :loading="uploadingIndex === index"
              @click="openFilePicker(index)"
            >
              {{ assignment.photoUrl ? 'Changer la photo' : 'Ajouter une photo' }}
            </UButton>
            <p class="text-xs text-gray-500 truncate">
              {{ photoLabel(assignment, index) }}
            </p>
          </div>
        </div>
        <UInput v-model="assignment.notes" placeholder="Notes" class="lg:col-span-2" />
        <div class="lg:col-span-1" />
      </div>

      <div v-if="!assignments.length" class="rounded border border-dashed border-gray-300 p-6 text-sm text-gray-500">
        Aucun personnage dans ce jeu.
      </div>

      <div class="flex gap-2">
        <UButton type="submit" color="primary" :loading="saving" :disabled="saving">
          Enregistrer le cast
        </UButton>
        <UButton type="button" color="neutral" to="/sessions">Retour</UButton>
      </div>

      <p v-if="serverError" class="text-red-500 text-sm">{{ serverError }}</p>
    </form>

    <UModal v-model:open="showPhotoPreview">
      <template #body>
        <div class="flex justify-center p-2">
          <img
            v-if="previewPhotoUrl"
            :src="previewPhotoUrl"
            alt=""
            class="max-h-[80vh] max-w-full rounded object-contain"
          >
        </div>
      </template>
    </UModal>
  </UCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  session: { type: Object, required: true },
  characters: { type: Array, required: true },
  participants: { type: Array, required: true },
  onSave: { type: Function, required: true }
})

const assignments = ref([])
const uploadingIndex = ref(null)
const saving = ref(false)
const serverError = ref('')
const fileInputs = ref([])
const selectedPhotoNames = ref({})
const showPhotoPreview = ref(false)
const previewPhotoUrl = ref('')

const sessionCharacters = computed(() => props.characters
  .filter((character) => character.gameId === props.session.gameId)
  .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'pj' ? -1 : 1)))

const participantOptions = computed(() => [
  { label: 'Aucun participant', value: '' },
  ...props.participants
    .filter((participant) => participant.games?.some((game) => game.id === props.session.gameId))
    .map((participant) => ({
      label: participant.email ? `${participant.name} - ${participant.email}` : participant.name,
      value: participant.id
    }))
])

const pnjCastableIds = computed(() => new Set(
  props.session.participants
    ?.filter((participant) => participant.role === 'organizer' || participant.role === 'npc')
    .map((participant) => participant.participantId || participant.participant?.id)
    .filter(Boolean) || []
))

function characterById(characterId) {
  return props.characters.find((character) => character.id === characterId)
}

function participantOptionsForAssignment(assignment) {
  const character = characterById(assignment.characterId)
  if (character?.type !== 'pnj') return participantOptions.value

  return participantOptions.value.filter((participant) => !participant.value || pnjCastableIds.value.has(participant.value))
}

watch([() => props.session, sessionCharacters], ([session]) => {
  const assignmentsByCharacterId = new Map((session.assignments || []).map((assignment) => [
    assignment.characterId || assignment.character?.id,
    assignment
  ]))

  assignments.value = sessionCharacters.value.map((character) => {
    const assignment = assignmentsByCharacterId.get(character.id)
    return {
      characterId: character.id,
      participantId: assignment?.participantId || assignment?.participant?.id || '',
      photoUrl: assignment?.photoUrl || '',
      notes: assignment?.notes || ''
    }
  })
  selectedPhotoNames.value = {}
}, { immediate: true })

function setFileInputRef(element, index) {
  if (element) {
    fileInputs.value[index] = element
  }
}

function openFilePicker(index) {
  fileInputs.value[index]?.click()
}

function photoLabel(assignment, index) {
  if (uploadingIndex.value === index) return 'Envoi en cours...'
  if (selectedPhotoNames.value[index]) return selectedPhotoNames.value[index]
  if (assignment.photoUrl) return 'Photo enregistrée'
  return 'Aucune photo'
}

function openPhotoPreview(photoUrl) {
  previewPhotoUrl.value = photoUrl
  showPhotoPreview.value = true
}

async function submit() {
  if (saving.value) return

  saving.value = true
  try {
    await props.onSave(assignments.value.filter((assignment) => assignment.characterId))
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  } finally {
    saving.value = false
  }
}

async function uploadAssignmentPhoto(event, assignment, index) {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return

  uploadingIndex.value = index
  selectedPhotoNames.value = {
    ...selectedPhotoNames.value,
    [index]: file.name
  }
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
