<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier le groupe' : 'Créer un groupe' }}
    </template>

    <form @submit.prevent="submit" class="w-full space-y-6">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localFaction.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localFaction.name" required autofocus size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Pitch">
        <UTextarea
          v-model="localFaction.pitch"
          :rows="5"
          size="lg"
          class="w-full"
          placeholder="Texte court présentant le groupe aux participants."
        />
      </UFormField>

      <UFormField label="Background">
        <UTextarea
          v-model="localFaction.background"
          :rows="16"
          size="lg"
          class="w-full font-mono text-sm"
          placeholder="Histoire complète du groupe."
        />
      </UFormField>

      <UFormField label="Lien vers un background externe">
        <UInput
          v-model="localFaction.backgroundDocumentUrl"
          type="url"
          size="lg"
          class="w-full"
          placeholder="Google Docs, PDF, DOCX ou ODT hébergé ailleurs"
        />
      </UFormField>

      <UFormField label="Indications costumes">
        <UTextarea v-model="localFaction.costumeIndications" :rows="5" size="lg" class="w-full" />
      </UFormField>

      <AppCheckboxRow
        v-model="localFaction.showInTrombinoscope"
        label="Afficher le nom du groupe dans les trombinoscopes"
        description="Désactivé par défaut pour ne pas révéler les appartenances de groupe."
      />

      <UFormField label="Personnages">
        <USelectMenu
          v-model="localFaction.characterIds"
          :items="characterOptions"
          value-key="value"
          multiple
          :disabled="!characterOptions.length"
          placeholder="Associer des personnages"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg" :disabled="!localFaction.name?.trim() || !localFaction.gameId">
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
import { CHARACTER_TYPES } from '~/utils/domain'

const props = defineProps({
  faction: { type: Object, required: true },
  games: { type: Array, required: true },
  characters: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:faction'])

const localFaction = ref({ ...props.faction })
const errors = ref({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const characterOptions = computed(() =>
  props.characters
    .filter((character) => character.gameId === localFaction.value.gameId)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === CHARACTER_TYPES.pj ? -1 : 1))
    .map((character) => ({
      label: `${character.type === CHARACTER_TYPES.pnj ? 'PNJ' : 'PJ'} - ${character.name}`,
      value: character.id
    }))
)

watch(() => props.faction, (newFaction) => {
  localFaction.value = {
    ...newFaction,
    showInTrombinoscope: Boolean(newFaction.showInTrombinoscope),
    characterIds: newFaction.characterIds || newFaction.characters?.map((character) => character.id) || []
  }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localFaction.value.gameId, () => {
  const validCharacterIds = new Set(characterOptions.value.map((character) => character.value))
  localFaction.value.characterIds = (localFaction.value.characterIds || []).filter((id) => validCharacterIds.has(id))
})

function validate() {
  errors.value = {}
  if (!localFaction.value.name?.trim()) {
    errors.value.name = 'Le nom est requis.'
  }
  if (!localFaction.value.gameId) {
    errors.value.gameId = 'Le jeu est requis.'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:faction', localFaction.value)
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>
