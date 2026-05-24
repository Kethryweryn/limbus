<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier le jeu' : 'Créer un nouveau jeu' }}
    </template>

    <form @submit.prevent="submit" class="w-full space-y-6">
      <UFormField label="Titre" :error="errors.title">
        <UInput v-model="localGame.title" required size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Description" :error="errors.description">
        <UTextarea v-model="localGame.description" :rows="10" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="URL du teaser vidéo" :error="errors.teaserUrl">
        <UInput v-model="localGame.teaserUrl" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Note d’intention" :error="errors.noteIntention">
        <UTextarea v-model="localGame.noteIntention" :rows="8" size="lg" class="w-full" />
      </UFormField>

      <AppCheckboxRow v-model="localGame.publicPage" label="Publier la page publique" />


      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg">
          {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
        </UButton>
        <UButton v-if="mode === 'edit'" @click="$emit('cancel')" color="neutral" size="lg">
          Annuler
        </UButton>
      </div>

      <p v-if="serverError" class="text-red-500 text-sm mt-2">{{ serverError }}</p>
    </form>
  </UCard>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  game: { type: Object, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:game'])

const localGame = ref({ ...props.game })
const errors = ref({})
const serverError = ref('')

watch(() => props.game, (newGame) => {
  localGame.value = { ...newGame }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

function validate() {
  errors.value = {}
  if (!localGame.value.title?.trim()) {
    errors.value.title = 'Le titre est requis.'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:game', localGame.value)
    await emit('submit') // le parent s’occupe d’appeler l’API
    serverError.value = ''
  } catch (err) {
    // Peut être string ou AxiosError, adaptatif :
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>
