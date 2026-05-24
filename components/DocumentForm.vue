<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier le document' : 'Créer un document' }}
    </template>

    <form @submit.prevent="submit" class="w-full space-y-6">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localDocument.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Titre" :error="errors.title">
        <UInput v-model="localDocument.title" required autofocus size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Corps" :error="errors.content">
        <UTextarea v-model="localDocument.content" :rows="12" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Document lié">
        <UInput v-model="localDocument.documentUrl" size="lg" class="w-full" placeholder="Lien PDF, docx, Google Docs..." />
      </UFormField>

      <UFormField label="Destinataires">
        <USelect
          v-model="localDocument.audience"
          :items="audienceOptions"
          value-key="value"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UCheckbox
        v-model="localDocument.readyToSend"
        label="Document prêt à être envoyé"
        description="Décochez pour repasser le document en brouillon."
      />

      <div v-if="localDocument.audience === DOCUMENT_AUDIENCES.targeted" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UFormField label="Personnage">
          <USelect
            v-model="localDocument.characterId"
            :items="characterOptions"
            value-key="value"
            :disabled="!localDocument.gameId"
            placeholder="Associer un personnage"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Groupes">
          <USelectMenu
            v-model="localDocument.factionIds"
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
        v-if="!hasTargets"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        title="Document non ciblé"
        description="Associez au moins un personnage ou un groupe, ou choisissez une audience générale."
      />

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
import {
  CHARACTER_TYPES,
  DOCUMENT_AUDIENCES,
  DOCUMENT_AUDIENCE_OPTIONS,
  VIRTUAL_CHARACTER_GROUP_OPTIONS,
  VIRTUAL_CHARACTER_GROUPS
} from '~/utils/domain'

const props = defineProps({
  document: { type: Object, required: true },
  games: { type: Array, required: true },
  characters: { type: Array, required: true },
  factions: { type: Array, required: true },
  mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:document'])

const localDocument = ref({ ...props.document })
const errors = ref({})
const serverError = ref('')

const audienceOptions = DOCUMENT_AUDIENCE_OPTIONS

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const characterOptions = computed(() => [
  { label: 'Aucun personnage', value: '' },
  ...props.characters
    .filter((character) => character.gameId === localDocument.value.gameId)
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === CHARACTER_TYPES.pj ? -1 : 1))
    .map((character) => ({
      label: `${character.type === CHARACTER_TYPES.pnj ? 'PNJ' : 'PJ'} - ${character.name}`,
      value: character.id
    }))
])

const virtualFactionOptions = VIRTUAL_CHARACTER_GROUP_OPTIONS

const realFactionOptions = computed(() =>
  props.factions
    .filter((faction) => faction.gameId === localDocument.value.gameId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((faction) => ({
      label: faction.name,
      value: faction.id
    }))
)

const factionOptions = computed(() => [
  ...virtualFactionOptions,
  ...realFactionOptions.value
])

const hasTargets = computed(() =>
  localDocument.value.audience !== DOCUMENT_AUDIENCES.targeted
  || Boolean(localDocument.value.characterId || localDocument.value.characterIds?.length || localDocument.value.factionIds?.length)
)

const canSubmit = computed(() =>
  localDocument.value.title?.trim()
  && localDocument.value.gameId
  && Boolean(localDocument.value.content?.trim() || localDocument.value.documentUrl?.trim())
)

watch(() => props.document, (newDocument) => {
  localDocument.value = {
    ...newDocument,
    audience: newDocument.audience || DOCUMENT_AUDIENCES.targeted,
    readyToSend: Boolean(newDocument.readyToSend),
    content: newDocument.content || '',
    documentUrl: newDocument.documentUrl || '',
    characterId: newDocument.characterId || newDocument.character?.id || '',
    characterIds: newDocument.characterIds || newDocument.characters?.map((character) => character.id) || [],
    factionIds: newDocument.factionIds || newDocument.factions?.map((faction) => faction.id) || []
  }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localDocument.value.gameId, () => {
  const validCharacterIds = new Set(characterOptions.value.map((character) => character.value))
  const validFactionIds = new Set(factionOptions.value.map((faction) => faction.value))
  if (localDocument.value.characterId && !validCharacterIds.has(localDocument.value.characterId)) {
    localDocument.value.characterId = ''
  }
  localDocument.value.factionIds = (localDocument.value.factionIds || []).filter((id) => validFactionIds.has(id))
})

function validate() {
  errors.value = {}
  if (!localDocument.value.title?.trim()) errors.value.title = 'Le titre est requis.'
  if (!localDocument.value.gameId) errors.value.gameId = 'Le jeu est requis.'
  if (!localDocument.value.content?.trim() && !localDocument.value.documentUrl?.trim()) {
    errors.value.content = 'Renseignez un corps ou un document lié.'
  }
  return Object.keys(errors.value).length === 0
}

function expandVirtualFactionSelection(value) {
  if (value.audience !== DOCUMENT_AUDIENCES.targeted) {
    return {
      ...value,
      characterId: '',
      characterIds: [],
      factionIds: []
    }
  }

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
    emit('update:document', expandVirtualFactionSelection(localDocument.value))
    await emit('submit')
    serverError.value = ''
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
  }
}
</script>
