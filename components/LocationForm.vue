<template>
  <UCard>
    <template #header>
      {{ mode === 'edit' ? 'Modifier le lieu' : 'Créer un lieu' }}
    </template>

    <form @submit.prevent="submit" class="space-y-4">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localLocation.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
        />
      </UFormField>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localLocation.name" required />
      </UFormField>

      <UFormField label="Adresse">
        <UTextarea v-model="localLocation.address" />
      </UFormField>

      <UFormField label="Notes">
        <UTextarea v-model="localLocation.notes" />
      </UFormField>

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
  location: { type: Object, required: true },
  games: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:location'])

const localLocation = ref({ ...props.location })
const errors = ref({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

watch(() => props.location, (newLocation) => {
  localLocation.value = { ...newLocation }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

function validate() {
  errors.value = {}
  if (!localLocation.value.name?.trim()) {
    errors.value.name = 'Le nom est requis.'
  }
  if (!localLocation.value.gameId) {
    errors.value.gameId = 'Le jeu est requis.'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:location', localLocation.value)
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>
