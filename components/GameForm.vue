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
        <UInput v-model.nullable="localGame.teaserUrl" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Note d’intention" :error="errors.noteIntention">
        <UTextarea v-model.nullable="localGame.noteIntention" :rows="8" size="lg" class="w-full" />
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
          description="Un bouton vers le questionnaire du vivier, quand il est ouvert."
        />
      </div>
      <AppCheckboxRow
        v-model="localGame.singlePjPerParticipant"
        label="Un seul PJ par participant et par session"
        description="Décochez pour un jeu en plusieurs actes, où un participant joue un rôle par acte."
      />

      <!-- Photos des participants (US-107, SPEC-012) : données dans le texte d'information des personnes -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UFormField label="Conservation des photos (mois après la session)" description="Les photos du cast et les trombinoscopes sont ensuite supprimés.">
          <UInputNumber v-model="localGame.photoRetentionMonths" :min="PHOTO_RETENTION_MIN_MONTHS" :max="PHOTO_RETENTION_MAX_MONTHS" class="w-full" />
        </UFormField>
        <UFormField label="Adresse de contact" description="Pour demander le retrait d’une photo. Facultative : à défaut, l’adresse de la propriétaire du jeu.">
          <UInput v-model.nullable="localGame.contactEmail" type="email" class="w-full" />
        </UFormField>
      </div>

      <!-- Attribut d'équilibre des personnages (US-091) : sert à la question d'équilibre et au tirage -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UFormField label="Attribut d’équilibre" description="Facultatif, par exemple « Genre du personnage ».">
          <UInput v-model.nullable="localGame.balanceAttribute" class="w-full" />
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

<script setup lang="ts">
import { ref, watch } from 'vue'
import { PHOTO_RETENTION_MAX_MONTHS, PHOTO_RETENTION_MIN_MONTHS } from '~/utils/photoInformation'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { GameDraft } from '~/utils/writingDrafts'

const props = withDefaults(defineProps<{
  game: GameDraft
  mode?: 'create' | 'edit'
  // Enregistrement par le parent (`@submit`), attendu pour afficher ici son erreur
  onSubmit: () => unknown
}>(), { mode: 'create' })

const emit = defineEmits<{ cancel: [], 'update:game': [game: GameDraft] }>()

const localGame = ref<GameDraft>({ ...props.game })

// Une valeur par ligne : le texte saisi reste tel quel, les valeurs envoyées sont sans lignes vides ni doublons
const balanceValuesText = ref((props.game.balanceValues || []).join('\n'))
watch(balanceValuesText, (text) => {
  localGame.value.balanceValues = [...new Set(String(text).split('\n').map((value) => value.trim()).filter(Boolean))]
})
const errors = ref<Record<string, string>>({})
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
    await props.onSubmit()
    serverError.value = ''
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Erreur inconnue')
  }
}
</script>
