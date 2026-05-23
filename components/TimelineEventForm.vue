<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier l’événement' : 'Créer un événement' }}
    </template>

    <form @submit.prevent="submit" class="w-full space-y-6">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localEvent.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
          size="lg"
          class="w-full"
        />
      </UFormField>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UFormField label="Jour" :error="errors.day">
          <UInput v-model="localEvent.day" type="number" min="1" required size="lg" class="w-full" />
        </UFormField>

        <UFormField label="Heure" :error="errors.time">
          <UInput v-model="localEvent.time" type="time" required size="lg" class="w-full" />
        </UFormField>

        <UFormField label="Responsables nécessaires">
          <UInput v-model="localEvent.requiredResponsibles" type="number" min="0" size="lg" class="w-full" />
        </UFormField>
      </div>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localEvent.name" required autofocus size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Description">
        <UTextarea v-model="localEvent.description" :rows="8" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Personnages liés">
        <USelectMenu
          v-model="localEvent.characterIds"
          :items="characterOptions"
          value-key="value"
          multiple
          :disabled="!characterOptions.length"
          placeholder="Associer des personnages"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Intrigues liées">
        <USelectMenu
          v-model="localEvent.intrigueIds"
          :items="intrigueOptions"
          value-key="value"
          multiple
          :disabled="!intrigueOptions.length"
          placeholder="Associer des intrigues"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Objets liés">
        <USelectMenu
          v-model="localEvent.itemIds"
          :items="itemOptions"
          value-key="value"
          multiple
          :disabled="!itemOptions.length"
          placeholder="Associer des objets"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg" :disabled="!canSubmit">
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
  event: { type: Object, required: true },
  games: { type: Array, required: true },
  characters: { type: Array, required: true },
  intrigues: { type: Array, required: true },
  items: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:event'])

const localEvent = ref({ ...props.event })
const errors = ref({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const characterOptions = computed(() =>
  props.characters
    .filter((character) => character.gameId === localEvent.value.gameId)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'pj' ? -1 : 1))
    .map((character) => ({
      label: `${character.type === 'pnj' ? 'PNJ' : 'PJ'} - ${character.name}`,
      value: character.id
    }))
)

const intrigueOptions = computed(() =>
  props.intrigues
    .filter((intrigue) => intrigue.gameId === localEvent.value.gameId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((intrigue) => ({
      label: intrigue.name,
      value: intrigue.id
    }))
)

const itemOptions = computed(() =>
  props.items
    .filter((item) => item.gameId === localEvent.value.gameId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      label: item.name,
      value: item.id
    }))
)

const canSubmit = computed(() =>
  localEvent.value.name?.trim()
  && localEvent.value.gameId
  && Number(localEvent.value.day) >= 1
  && /^\d{2}:\d{2}$/.test(localEvent.value.time || '')
)

watch(() => props.event, (newEvent) => {
  localEvent.value = {
    ...newEvent,
    day: newEvent.day || 1,
    time: newEvent.time || '12:00',
    requiredResponsibles: newEvent.requiredResponsibles ?? 0,
    characterIds: newEvent.characterIds || newEvent.characters?.map((character) => character.id) || [],
    intrigueIds: newEvent.intrigueIds || newEvent.intrigues?.map((intrigue) => intrigue.id) || [],
    itemIds: newEvent.itemIds || newEvent.items?.map((item) => item.id) || []
  }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localEvent.value.gameId, () => {
  const validCharacterIds = new Set(characterOptions.value.map((character) => character.value))
  const validIntrigueIds = new Set(intrigueOptions.value.map((intrigue) => intrigue.value))
  const validItemIds = new Set(itemOptions.value.map((item) => item.value))
  localEvent.value.characterIds = (localEvent.value.characterIds || []).filter((id) => validCharacterIds.has(id))
  localEvent.value.intrigueIds = (localEvent.value.intrigueIds || []).filter((id) => validIntrigueIds.has(id))
  localEvent.value.itemIds = (localEvent.value.itemIds || []).filter((id) => validItemIds.has(id))
})

function validate() {
  errors.value = {}
  if (!localEvent.value.name?.trim()) errors.value.name = 'Le nom est requis.'
  if (!localEvent.value.gameId) errors.value.gameId = 'Le jeu est requis.'
  if (!Number(localEvent.value.day) || Number(localEvent.value.day) < 1) errors.value.day = 'Le jour est requis.'
  if (!/^\d{2}:\d{2}$/.test(localEvent.value.time || '')) errors.value.time = 'L’heure est requise.'
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:event', {
      ...localEvent.value,
      day: Number(localEvent.value.day),
      requiredResponsibles: Number(localEvent.value.requiredResponsibles || 0)
    })
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>
