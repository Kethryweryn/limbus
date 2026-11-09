<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier l’intrigue' : 'Créer une intrigue' }}
    </template>

    <form class="w-full space-y-6" @submit.prevent="submit">
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
        <UTextarea v-model.nullable="localIntrigue.pitch" :rows="5" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Description">
        <UTextarea v-model.nullable="localIntrigue.description" :rows="14" size="lg" class="w-full" />
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
import {
  CHARACTER_TYPES,
  INTRIGUE_LEVEL_OPTIONS,
  INTRIGUE_LEVELS,
  VIRTUAL_CHARACTER_GROUP_OPTIONS,
  VIRTUAL_CHARACTER_GROUPS
} from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { CharacterOption, FactionOption, GameOption, IntrigueDraft } from '~/utils/writingDrafts'

const props = withDefaults(defineProps<{
  // Enregistrement par le parent (`@submit`), attendu pour afficher ici son erreur
  onSubmit: () => unknown
  intrigue: IntrigueDraft
  games: GameOption[]
  characters: CharacterOption[]
  factions: FactionOption[]
  mode?: 'create' | 'edit'
}>(), { mode: 'create' })

const emit = defineEmits<{ cancel: [], 'update:intrigue': [intrigue: IntrigueDraft] }>()

const localIntrigue = ref<IntrigueDraft>({ ...props.intrigue })
const errors = ref<Record<string, string>>({})
const serverError = ref('')

const levelOptions: Array<{ label: string, value: string }> = [...INTRIGUE_LEVEL_OPTIONS]

const virtualFactionOptions: Array<{ label: string, value: string }> = [...VIRTUAL_CHARACTER_GROUP_OPTIONS]

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const characterOptions = computed(() =>
  props.characters
    .filter((character) => character.gameId === localIntrigue.value.gameId)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === CHARACTER_TYPES.pj ? -1 : 1))
    .map((character) => ({
      label: `${character.type === CHARACTER_TYPES.pnj ? 'PNJ' : 'PJ'} - ${character.name}`,
      value: character.id
    }))
)

const realFactionOptions = computed(() =>
  props.factions
    .filter((faction) => faction.gameId === localIntrigue.value.gameId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((faction) => ({ label: faction.name, value: faction.id }))
)

const factionOptions = computed(() => [
  ...virtualFactionOptions,
  ...realFactionOptions.value
])

const hasAssignments = computed(() =>
  Boolean(localIntrigue.value.characterIds?.length || localIntrigue.value.factionIds?.length)
)

watch(() => props.intrigue, (newIntrigue) => {
  localIntrigue.value = {
    ...newIntrigue,
    level: newIntrigue.level || INTRIGUE_LEVELS.minor,
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

function expandVirtualFactionSelection(value: IntrigueDraft): IntrigueDraft {
  const factionIds = value.factionIds || []
  const selectedVirtualIds = new Set(factionIds.filter((id) => id.startsWith('__')))
  const realFactionIds = factionIds.filter((id) => !id.startsWith('__'))
  const gameCharacters = props.characters.filter((character) => character.gameId === value.gameId)
  const expandedCharacterIds = gameCharacters
    .filter((character) =>
      selectedVirtualIds.has(VIRTUAL_CHARACTER_GROUPS.allCharacters)
      || (selectedVirtualIds.has(VIRTUAL_CHARACTER_GROUPS.allPj) && character.type !== CHARACTER_TYPES.pnj)
      || (selectedVirtualIds.has(VIRTUAL_CHARACTER_GROUPS.allPnj) && character.type === CHARACTER_TYPES.pnj)
    )
    .map((character) => character.id)

  return {
    ...value,
    factionIds: realFactionIds,
    characterIds: [...new Set([...(value.characterIds || []), ...expandedCharacterIds])]
  }
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:intrigue', expandVirtualFactionSelection(localIntrigue.value))
    await props.onSubmit()
    serverError.value = ''
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Erreur inconnue')
  }
}
</script>
