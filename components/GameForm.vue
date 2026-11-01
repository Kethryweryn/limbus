<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier le jeu' : 'Créer un nouveau jeu' }}
    </template>

    <form class="w-full space-y-6" @submit.prevent="submit">
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
      <div v-if="localGame.publicPage" class="space-y-2 pl-6">
        <AppCheckboxRow
          v-model="localGame.publicShowSessions"
          label="Afficher les sessions à venir"
          description="Les sessions marquées visibles sur la page publique, avec leur date et leur lieu."
        />
        <AppCheckboxRow
          v-model="localGame.publicShowRegistration"
          label="Afficher le lien d’inscription"
          description="Un bouton vers le formulaire de chaque période d’inscription ouverte en mode formulaire."
        />
      </div>
      <AppCheckboxRow
        v-model="localGame.singlePjPerParticipant"
        label="Un seul PJ par participant et par session"
        description="Décochez pour un jeu en plusieurs actes, où un participant joue un rôle par acte."
      />

      <!-- Attribut d'équilibre des personnages (US-091) : sert à la question d'équilibre et au tirage -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UFormField label="Attribut d’équilibre" description="Facultatif, par exemple « Genre du personnage ».">
          <UInput v-model="localGame.balanceAttribute" class="w-full" />
        </UFormField>
        <UFormField v-if="localGame.balanceAttribute?.trim()" label="Valeurs" description="Une par ligne, par exemple F, H, Autre.">
          <UTextarea v-model="balanceValuesText" :rows="3" class="w-full" />
        </UFormField>
      </div>


      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg">
          {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
        </UButton>
        <UButton v-if="mode === 'edit'" color="neutral" size="lg" @click="$emit('cancel')">
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

// Une valeur par ligne : le texte saisi reste tel quel, les valeurs envoyées sont sans lignes vides ni doublons
const balanceValuesText = ref((props.game.balanceValues || []).join('\n'))
watch(balanceValuesText, (text) => {
  localGame.value.balanceValues = [...new Set(String(text).split('\n').map((value) => value.trim()).filter(Boolean))]
})
const errors = ref({})
const serverError = ref('')

watch(() => props.game, (newGame) => {
  localGame.value = { ...newGame }
  balanceValuesText.value = (newGame.balanceValues || []).join('\n')
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
