<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier le lieu' : 'Créer un lieu' }}
    </template>

    <form class="w-full space-y-6" @submit.prevent="submit">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localLocation.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localLocation.name" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Adresse">
        <UTextarea v-model.nullable="localLocation.address" :rows="8" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Notes">
        <UTextarea v-model.nullable="localLocation.notes" :rows="8" size="lg" class="w-full" />
      </UFormField>

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

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { GameOption, LocationDraft } from '~/utils/writingDrafts'

const props = withDefaults(defineProps<{
  // Enregistrement par le parent (`@submit`), attendu pour afficher ici son erreur
  onSubmit: () => unknown
  location: LocationDraft
  games: GameOption[]
  mode?: 'create' | 'edit'
}>(), { mode: 'create' })

const emit = defineEmits<{ cancel: [], 'update:location': [location: LocationDraft] }>()

const localLocation = ref<LocationDraft>({ ...props.location })
const errors = ref<Record<string, string>>({})
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
    await props.onSubmit()
    serverError.value = ''
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Erreur inconnue')
  }
}
</script>
