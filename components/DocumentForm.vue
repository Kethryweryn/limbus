<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier le document' : 'Créer un document' }}
    </template>

    <form class="w-full space-y-6" @submit.prevent="submit">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localDocument.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Titre" :error="errors.title">
        <UInput v-model="localDocument.title" autofocus size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Corps" :error="errors.content">
        <UTextarea v-model.nullable="localDocument.content" :rows="12" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Document lié">
        <UInput v-model.nullable="localDocument.documentUrl" size="lg" class="w-full" placeholder="Lien PDF, docx, Google Docs..." />
      </UFormField>

      <!-- Public par cases (US-187) : « Tout le monde » coche les quatre rôles. Un groupe de cases, pas un champ : chaque
           case garde son propre libellé -->
      <fieldset class="space-y-2">
        <legend class="text-sm font-medium text-default">Destinataires</legend>
        <div class="flex flex-wrap gap-x-6 gap-y-2">
          <UCheckbox :model-value="everyone" label="Tout le monde" @update:model-value="setEveryone($event === true)" />
          <UCheckbox
            v-for="role in DOCUMENT_ROLE_OPTIONS"
            :key="role.value"
            :model-value="localDocument.audiences.includes(role.value)"
            :label="role.label"
            @update:model-value="toggleRole(role.value, $event === true)"
          />
        </div>
      </fieldset>

      <AppCheckboxRow
        v-model="advanced"
        label="Sélection avancée"
        description="Ajoutez des personnages ou des groupes, en plus des cases cochées."
      />

      <div v-if="advanced" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UFormField label="Personnages">
          <USelectMenu
            v-model="localDocument.characterIds"
            :items="characterOptions"
            value-key="value"
            multiple
            :disabled="!localDocument.gameId"
            placeholder="Choisir des personnages"
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
            placeholder="Choisir des groupes"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>

      <AppCheckboxRow
        v-model="localDocument.readyToSend"
        label="Document prêt à être envoyé"
        description="Décochez pour repasser le document en brouillon."
      />

      <UAlert
        v-if="!hasTargets"
        color="warning"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        title="Document non ciblé"
        description="Cochez au moins un public, ou ajoutez des personnages ou des groupes."
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
import { CHARACTER_TYPES } from '~/utils/domain'
import { ALL_DOCUMENT_ROLES, DOCUMENT_ROLE_OPTIONS, documentRoles, isDocumentTargeted, isEveryone, type DocumentRole } from '~/utils/documentAudiences'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { CharacterOption, DocumentDraft, FactionOption, GameOption } from '~/utils/writingDrafts'

type EditedDocument = DocumentDraft & { audiences: string[], characterIds: string[], factionIds: string[] }

const props = withDefaults(defineProps<{
  // Enregistrement par le parent (`@submit`), attendu pour afficher ici son erreur
  onSubmit: () => unknown
  document: DocumentDraft
  games: GameOption[]
  characters: CharacterOption[]
  factions: FactionOption[]
  mode?: 'create' | 'edit'
}>(), { mode: 'create' })

const emit = defineEmits<{ cancel: [], 'update:document': [document: DocumentDraft] }>()

const localDocument = ref<EditedDocument>({ ...props.document, audiences: [], characterIds: [], factionIds: [] })
const advanced = ref(false)
const errors = ref<Record<string, string>>({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

const characterOptions = computed(() => props.characters
  .filter((character) => character.gameId === localDocument.value.gameId)
  .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === CHARACTER_TYPES.pj ? -1 : 1))
  .map((character) => ({
    label: `${character.type === CHARACTER_TYPES.pnj ? 'PNJ' : 'PJ'} - ${character.name}`,
    value: character.id
  })))

// Les groupes du jeu seulement : « tous les PJ » ou « tous les PNJ » se cochent dans les cases (US-187)
const factionOptions = computed(() => props.factions
  .filter((faction) => faction.gameId === localDocument.value.gameId)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((faction) => ({
    label: faction.name,
    value: faction.id
  })))

const everyone = computed(() => isEveryone(localDocument.value.audiences))

function setEveryone(checked: boolean) {
  localDocument.value.audiences = checked ? [...ALL_DOCUMENT_ROLES] : []
}

function toggleRole(role: DocumentRole, checked: boolean) {
  const others = localDocument.value.audiences.filter((value) => value !== role)
  localDocument.value.audiences = checked ? [...others, role] : others
}

const hasTargets = computed(() => isDocumentTargeted({
  audiences: localDocument.value.audiences,
  characters: advanced.value ? localDocument.value.characterIds : [],
  factions: advanced.value ? localDocument.value.factionIds : []
}))

watch(() => props.document, (newDocument) => {
  const characterIds = newDocument.characterIds || newDocument.characters?.map((character) => character.id) || []
  const factionIds = newDocument.factionIds || newDocument.factions?.map((faction) => faction.id) || []
  localDocument.value = {
    ...newDocument,
    audiences: documentRoles(newDocument),
    readyToSend: Boolean(newDocument.readyToSend),
    content: newDocument.content || '',
    documentUrl: newDocument.documentUrl || '',
    characterIds,
    factionIds
  }
  // La sélection avancée s'ouvre d'elle-même pour un document qui en a une
  advanced.value = Boolean(characterIds.length || factionIds.length)
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localDocument.value.gameId, () => {
  const validCharacterIds = new Set(characterOptions.value.map((character) => character.value))
  const validFactionIds = new Set(factionOptions.value.map((faction) => faction.value))
  localDocument.value.characterIds = localDocument.value.characterIds.filter((id) => validCharacterIds.has(id))
  localDocument.value.factionIds = localDocument.value.factionIds.filter((id) => validFactionIds.has(id))
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

async function submit() {
  if (!validate()) return

  try {
    // Sélection avancée décochée : ses personnages et groupes ne sont pas gardés
    emit('update:document', advanced.value ? { ...localDocument.value } : { ...localDocument.value, characterIds: [], factionIds: [] })
    await props.onSubmit()
    serverError.value = ''
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Erreur inconnue')
  }
}
</script>
