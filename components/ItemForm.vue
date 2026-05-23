<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier l’objet' : 'Créer un objet' }}
    </template>

    <form @submit.prevent="submit" class="w-full space-y-6">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localItem.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localItem.name" required autofocus size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Description">
        <UTextarea v-model="localItem.description" :rows="8" size="lg" class="w-full" />
      </UFormField>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UFormField label="Localisation chez un participant">
          <USelect
            v-model="localItem.locationParticipantId"
            :items="locationParticipantOptions"
            value-key="value"
            :disabled="!localItem.gameId"
            placeholder="Sélectionner un participant"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Localisation libre">
          <UInput
            v-model="localItem.locationText"
            :disabled="Boolean(localItem.locationParticipantId)"
            size="lg"
            class="w-full"
            placeholder="Salle, coffre, régie..."
          />
        </UFormField>
      </div>

      <UFormField label="Participants associés">
        <USelectMenu
          v-model="localItem.participantIds"
          :items="participantOptions"
          value-key="value"
          multiple
          :disabled="!participantOptions.length"
          placeholder="Associer des participants"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Intrigues associées">
        <USelectMenu
          v-model="localItem.intrigueIds"
          :items="intrigueOptions"
          value-key="value"
          multiple
          :disabled="!intrigueOptions.length"
          placeholder="Associer des intrigues"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UAlert
        v-if="isUnassigned"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        title="Objet non associé"
        description="Cet objet n’est associé à aucun participant ni aucune intrigue."
      />

      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg" :disabled="!localItem.name?.trim() || !localItem.gameId">
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
  item: { type: Object, required: true },
  games: { type: Array, required: true },
  participants: { type: Array, required: true },
  intrigues: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:item'])

const localItem = ref({ ...props.item })
const errors = ref({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const participantOptions = computed(() =>
  props.participants
    .filter((participant) => participant.games?.some((game) => game.id === localItem.value.gameId))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((participant) => ({
      label: participant.email ? `${participant.name} - ${participant.email}` : participant.name,
      value: participant.id
    }))
)

const locationParticipantOptions = computed(() => [
  { label: 'Aucun participant', value: '' },
  ...participantOptions.value
])

const intrigueOptions = computed(() =>
  props.intrigues
    .filter((intrigue) => intrigue.gameId === localItem.value.gameId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((intrigue) => ({
      label: intrigue.name,
      value: intrigue.id
    }))
)

const isUnassigned = computed(() => !(localItem.value.participantIds?.length || localItem.value.intrigueIds?.length))

watch(() => props.item, (newItem) => {
  localItem.value = {
    ...newItem,
    participantIds: newItem.participantIds || newItem.participants?.map((participant) => participant.id) || [],
    intrigueIds: newItem.intrigueIds || newItem.intrigues?.map((intrigue) => intrigue.id) || [],
    locationParticipantId: newItem.locationParticipantId || newItem.locationParticipant?.id || '',
    locationText: newItem.locationText || ''
  }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localItem.value.locationParticipantId, (participantId) => {
  if (participantId) {
    localItem.value.locationText = ''
  }
})

watch(() => localItem.value.gameId, () => {
  const validParticipantIds = new Set(participantOptions.value.map((participant) => participant.value))
  const validIntrigueIds = new Set(intrigueOptions.value.map((intrigue) => intrigue.value))
  localItem.value.participantIds = (localItem.value.participantIds || []).filter((id) => validParticipantIds.has(id))
  localItem.value.intrigueIds = (localItem.value.intrigueIds || []).filter((id) => validIntrigueIds.has(id))
  if (localItem.value.locationParticipantId && !validParticipantIds.has(localItem.value.locationParticipantId)) {
    localItem.value.locationParticipantId = ''
  }
})

function validate() {
  errors.value = {}
  if (!localItem.value.name?.trim()) {
    errors.value.name = 'Le nom est requis.'
  }
  if (!localItem.value.gameId) {
    errors.value.gameId = 'Le jeu est requis.'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:item', localItem.value)
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>
