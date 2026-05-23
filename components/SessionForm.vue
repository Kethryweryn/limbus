<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier la session' : 'Créer une session' }}
    </template>

    <form @submit.prevent="submit" class="w-full space-y-6">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localSession.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localSession.name" required size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Statut">
        <USelect
          v-model="localSession.status"
          :items="statusOptions"
          value-key="value"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Date">
        <UInput v-model="localSession.date" type="datetime-local" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Lieu">
        <USelect
          v-model="localSession.locationId"
          :items="locationOptions"
          value-key="value"
          placeholder="Choisissez un lieu"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UFormField label="Organisateurs">
          <USelectMenu
            v-model="localSession.organizerIds"
            :items="sessionParticipantOptions"
            value-key="value"
            multiple
            :disabled="!sessionParticipantOptions.length"
            placeholder="Sélectionner les organisateurs"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="PNJ de session">
          <USelectMenu
            v-model="localSession.npcIds"
            :items="sessionParticipantOptions"
            value-key="value"
            multiple
            :disabled="!sessionParticipantOptions.length"
            placeholder="Sélectionner les PNJ"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>

      <div v-if="showCast" class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Cast</h3>
        </div>

        <div
          v-for="(assignment, index) in localSession.assignments"
          :key="index"
          class="grid grid-cols-1 md:grid-cols-12 gap-2 items-start rounded border border-gray-200 p-3"
        >
          <div class="md:col-span-3 min-w-0">
            <div class="flex items-center gap-2">
              <UBadge color="warning" variant="subtle" size="xs">
                {{ characterById(assignment.characterId)?.type === 'pnj' ? 'PNJ' : 'PJ' }}
              </UBadge>
              <span class="font-medium truncate">{{ characterById(assignment.characterId)?.name || 'Personnage inconnu' }}</span>
            </div>
          </div>
          <USelect
            v-model="assignment.participantId"
            :items="participantOptionsForAssignment(assignment)"
            value-key="value"
            placeholder="Participant"
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
          <div class="md:col-span-1" />
        </div>
      </div>

      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg">
          {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
        </UButton>
        <UButton type="button" color="neutral" size="lg" @click="$emit('cancel')">
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
  participants: { type: Array, required: true },
  mode: { type: String, default: 'create' },
  showCast: { type: Boolean, default: true }
})

const emit = defineEmits(['submit', 'cancel', 'update:session'])

const localSession = ref({ ...props.session })
const errors = ref({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const statusOptions = [
  { label: 'Prévue', value: 'scheduled' },
  { label: 'Reportée', value: 'postponed' },
  { label: 'Annulée', value: 'cancelled' },
  { label: 'Terminée', value: 'completed' }
]

const sessionCharacters = computed(() => props.characters
  .filter((character) => !localSession.value.gameId || character.gameId === localSession.value.gameId)
  .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'pj' ? -1 : 1)))

const locationOptions = computed(() => [
  { label: 'Aucun lieu', value: '' },
  ...props.locations
    .filter((location) => !localSession.value.gameId || location.gameId === localSession.value.gameId)
    .map((location) => ({
      label: location.address ? `${location.name} - ${location.address}` : location.name,
      value: location.id
    }))
])

const participantOptions = computed(() => [
  { label: 'Aucun participant', value: '' },
  ...props.participants
    .filter((participant) => !localSession.value.gameId || participant.games?.some((game) => game.id === localSession.value.gameId))
    .map((participant) => ({
      label: participant.email ? `${participant.name} - ${participant.email}` : participant.name,
      value: participant.id
    }))
])

const sessionParticipantOptions = computed(() => participantOptions.value.filter((participant) => participant.value))

const selectedOrganizerIds = computed(() => new Set(localSession.value.organizerIds || []))
const selectedNpcIds = computed(() => new Set(localSession.value.npcIds || []))
const pnjCastableIds = computed(() => new Set([
  ...selectedOrganizerIds.value,
  ...selectedNpcIds.value
]))

function characterById(characterId) {
  return props.characters.find((character) => character.id === characterId)
}

function participantOptionsForAssignment(assignment) {
  const character = characterById(assignment.characterId)
  if (character?.type !== 'pnj') return participantOptions.value

  return participantOptions.value.filter((participant) => !participant.value || pnjCastableIds.value.has(participant.value))
}

function sessionRoleIds(session, role) {
  return session.participants
    ?.filter((participant) => participant.role === role)
    .map((participant) => participant.participantId || participant.participant?.id)
    .filter(Boolean) || []
}

function sessionParticipantsPayload(session) {
  const explicitParticipants = [
    ...(session.organizerIds || []).map((participantId) => ({ participantId, role: 'organizer' })),
    ...(session.npcIds || []).map((participantId) => ({ participantId, role: 'npc' }))
  ]
  const explicitIds = new Set(explicitParticipants.map((participant) => participant.participantId))
  const castParticipantIds = [...new Set((session.assignments || [])
    .map((assignment) => assignment.participantId)
    .filter((participantId) => participantId && !explicitIds.has(participantId)))]
  const castParticipants = castParticipantIds
    .map((participantId) => ({ participantId, role: 'participant' }))

  return [...explicitParticipants, ...castParticipants]
}

watch(() => props.session, (newSession) => {
  const assignmentsByCharacterId = new Map((newSession.assignments || []).map((assignment) => [
    assignment.characterId || assignment.character?.id,
    assignment
  ]))

  localSession.value = {
    ...newSession,
    organizerIds: newSession.organizerIds || sessionRoleIds(newSession, 'organizer'),
    npcIds: newSession.npcIds || sessionRoleIds(newSession, 'npc'),
    assignments: props.showCast
      ? sessionCharacters.value.map((character) => {
          const assignment = assignmentsByCharacterId.get(character.id)
          return {
            characterId: character.id,
            participantId: assignment?.participantId || assignment?.participant?.id || '',
            photoUrl: assignment?.photoUrl || '',
            notes: assignment?.notes || ''
          }
        })
      : newSession.assignments?.map((assignment) => ({
          characterId: assignment.characterId || assignment.character?.id || '',
          participantId: assignment.participantId || assignment.participant?.id || '',
          photoUrl: assignment.photoUrl || '',
          notes: assignment.notes || ''
        })) || []
  }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localSession.value.gameId, () => {
  if (props.showCast) {
    const assignmentsByCharacterId = new Map((localSession.value.assignments || []).map((assignment) => [assignment.characterId, assignment]))
    localSession.value.assignments = sessionCharacters.value.map((character) => ({
      characterId: character.id,
      participantId: assignmentsByCharacterId.get(character.id)?.participantId || '',
      photoUrl: assignmentsByCharacterId.get(character.id)?.photoUrl || '',
      notes: assignmentsByCharacterId.get(character.id)?.notes || ''
    }))
    return
  }

  localSession.value.assignments = localSession.value.assignments?.filter((assignment) =>
    props.characters.some((character) => character.id === assignment.characterId && character.gameId === localSession.value.gameId)
  ) || []
})

watch([() => localSession.value.organizerIds, () => localSession.value.npcIds], () => {
  localSession.value.assignments = (localSession.value.assignments || []).map((assignment) => {
    const character = characterById(assignment.characterId)
    if (character?.type === 'pnj' && assignment.participantId && !pnjCastableIds.value.has(assignment.participantId)) {
      return { ...assignment, participantId: '' }
    }
    return assignment
  })
}, { deep: true })

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
      assignments: localSession.value.assignments.filter((assignment) => assignment.characterId),
      participants: sessionParticipantsPayload(localSession.value)
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
