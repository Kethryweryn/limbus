<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier l’intrigue' : 'Créer une intrigue' }}
    </template>

    <form @submit.prevent="submit" class="w-full space-y-6">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localIntrigue.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
          size="lg"
          class="w-full"
        />
      </UFormField>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UFormField label="Nom" :error="errors.name">
          <UInput v-model="localIntrigue.name" required autofocus size="lg" class="w-full" />
        </UFormField>

        <UFormField label="Niveau" :error="errors.level">
          <USelect
            v-model="localIntrigue.level"
            :items="levelOptions"
            value-key="value"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField label="Pitch">
        <UTextarea v-model="localIntrigue.pitch" :rows="5" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Description">
        <UTextarea v-model="localIntrigue.description" :rows="14" size="lg" class="w-full" />
      </UFormField>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UFormField label="Personnages">
          <USelectMenu
            v-model="localIntrigue.characterIds"
            :items="characterOptions"
            value-key="value"
            multiple
            :disabled="!characterOptions.length"
            placeholder="Associer des personnages"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Groupes">
          <USelectMenu
            v-model="localIntrigue.factionIds"
            :items="factionOptions"
            value-key="value"
            multiple
            :disabled="!factionOptions.length"
            placeholder="Associer des groupes"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>

      <UAlert
        v-if="!hasAssignments"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        title="Intrigue non associée"
        description="Associez au moins un personnage ou un groupe pour que cette intrigue soit exploitable."
      />

      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg" :disabled="!localIntrigue.name?.trim() || !localIntrigue.gameId">
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
  intrigue: { type: Object, required: true },
  games: { type: Array, required: true },
  characters: { type: Array, required: true },
  factions: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:intrigue'])

const localIntrigue = ref({ ...props.intrigue })
const errors = ref({})
const serverError = ref('')

const levelOptions = [
  { label: 'Trame principale scénario', value: 'main_story' },
  { label: 'Trame principale personnage', value: 'main_character' },
  { label: 'Intrigue majeure', value: 'major' },
  { label: 'Intrigue mineure', value: 'minor' }
]

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const characterOptions = computed(() =>
  props.characters
    .filter((character) => character.gameId === localIntrigue.value.gameId)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'pj' ? -1 : 1))
    .map((character) => ({
      label: `${character.type === 'pnj' ? 'PNJ' : 'PJ'} - ${character.name}`,
      value: character.id
    }))
)

const factionOptions = computed(() =>
  props.factions
    .filter((faction) => faction.gameId === localIntrigue.value.gameId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((faction) => ({ label: faction.name, value: faction.id }))
)

const hasAssignments = computed(() =>
  Boolean(localIntrigue.value.characterIds?.length || localIntrigue.value.factionIds?.length)
)

watch(() => props.intrigue, (newIntrigue) => {
  localIntrigue.value = {
    ...newIntrigue,
    level: newIntrigue.level || 'minor',
    characterIds: newIntrigue.characterIds || newIntrigue.characters?.map((character) => character.id) || [],
    factionIds: newIntrigue.factionIds || newIntrigue.factions?.map((faction) => faction.id) || []
  }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localIntrigue.value.gameId, () => {
  const validCharacterIds = new Set(characterOptions.value.map((character) => character.value))
  const validFactionIds = new Set(factionOptions.value.map((faction) => faction.value))

  localIntrigue.value.characterIds = (localIntrigue.value.characterIds || []).filter((id) => validCharacterIds.has(id))
  localIntrigue.value.factionIds = (localIntrigue.value.factionIds || []).filter((id) => validFactionIds.has(id))
})

function validate() {
  errors.value = {}
  if (!localIntrigue.value.name?.trim()) {
    errors.value.name = 'Le nom est requis.'
  }
  if (!localIntrigue.value.gameId) {
    errors.value.gameId = 'Le jeu est requis.'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:intrigue', localIntrigue.value)
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>
