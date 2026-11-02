<template>
  <!-- Relations du personnage (US-097, ADR-0050) : chaque côté a son libellé et sa visibilité dans la fiche envoyée -->
  <div class="space-y-2">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-xl font-semibold">Relations</h2>
      <UButton color="neutral" variant="soft" size="sm" icon="i-heroicons-plus" :disabled="!others.length" @click="startCreate">
        Ajouter une relation
      </UButton>
    </div>
    <UAlert v-if="message" color="error" variant="soft" :description="message" />
    <p v-if="!relations.length" class="text-sm text-gray-500">
      {{ others.length ? 'Aucune relation pour l’instant.' : 'Créez d’autres personnages dans ce jeu pour les relier.' }}
    </p>
    <ul v-else class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      <li v-for="side in sides" :key="side.relation.id" class="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0 text-sm">
          <div class="flex flex-wrap items-center gap-2">
            <NuxtLink :to="`/characters/${side.other?.slug}`" class="font-medium text-gray-800 hover:underline">{{ side.other?.name }}</NuxtLink>
            <UBadge color="neutral" variant="subtle">{{ characterRelationTypeLabel(side.relation.type) }}</UBadge>
            <span v-if="side.label" class="text-gray-600">{{ character.name }} : {{ side.label }}</span>
            <UBadge v-if="side.visible" size="sm" color="primary" variant="outline" icon="i-heroicons-eye">Dans sa fiche</UBadge>
          </div>
          <p v-if="side.otherLabel" class="text-xs text-gray-500">{{ side.other?.name }} : {{ side.otherLabel }}</p>
          <p v-if="side.relation.description" class="mt-1 whitespace-pre-line text-gray-600">{{ side.relation.description }}</p>
        </div>
        <div class="flex shrink-0 gap-1">
          <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-pencil-square" aria-label="Modifier" @click="startEdit(side)" />
          <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" aria-label="Supprimer" @click="remove(side.relation)" />
        </div>
      </li>
    </ul>

    <UModal v-model:open="showForm" :title="form.id ? 'Modifier la relation' : 'Nouvelle relation'">
      <template #body>
        <form class="space-y-4" @submit.prevent="save">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UFormField label="Avec" required>
              <USelectMenu v-model="form.otherId" :items="otherItems" value-key="value" placeholder="Choisir un personnage" class="w-full" />
            </UFormField>
            <UFormField label="Type" required>
              <USelect v-model="form.type" :items="relationTypeItems" value-key="value" class="w-full" />
            </UFormField>
            <UFormField :label="`Rôle de ${character.name}`" description="Facultatif, par exemple « supérieure de ».">
              <UInput v-model="form.label" class="w-full" />
            </UFormField>
            <UFormField :label="`Rôle de ${otherName || 'l’autre personnage'}`" description="Facultatif, par exemple « subordonné de ».">
              <UInput v-model="form.otherLabel" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Description">
            <UTextarea v-model="form.description" :rows="3" class="w-full" />
          </UFormField>
          <div class="space-y-1">
            <p class="text-sm font-medium text-gray-700">Visible du joueur, dans la fiche personnage envoyée</p>
            <UCheckbox v-model="form.visible" :label="`Dans la fiche de ${character.name}`" />
            <UCheckbox v-model="form.otherVisible" :label="`Dans la fiche de ${otherName || 'l’autre personnage'}`" />
          </div>
          <UAlert v-if="formError" color="error" variant="soft" :description="formError" />
          <div class="flex flex-wrap gap-2">
            <UButton type="submit" color="primary" :loading="saving" :disabled="!form.otherId">Enregistrer</UButton>
            <UButton color="neutral" variant="soft" @click="showForm = false">Annuler</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { CHARACTER_RELATION_TYPES, characterRelationTypeLabel, relationSide } from '~/utils/characterRelations'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

type Relation = ApiResponse<'/api/characters/:id/relations'>[number]
type CharacterRef = { id: string, name: string, gameId: string }

const props = withDefaults(defineProps<{
  // Le personnage de la page
  character: CharacterRef
  // Les personnages du même jeu, pour choisir l'autre côté
  characters?: CharacterRef[]
}>(), { characters: () => [] })

const relations = ref<Relation[]>([])
const relationTypeItems: Array<{ label: string, value: string }> = [...CHARACTER_RELATION_TYPES]
const message = ref('')

async function load() {
  try {
    // Lue avec le réseau, elle reste lisible hors ligne avec la fiche (US-047)
    const data = await useApiFetch(`/api/characters/${props.character.id}/relations`, { offlineCache: true })
    relations.value = data
    message.value = ''
  } catch (err) {
    message.value = apiErrorMessage(err, 'Impossible de charger les relations')
  }
}
onMounted(load)
watch(() => props.character.id, load)

const sides = computed(() => relations.value.map((relation) => relationSide(relation, props.character.id)))
const others = computed(() => props.characters.filter((entry) => entry.gameId === props.character.gameId && entry.id !== props.character.id))
const otherItems = computed(() => others.value.map((entry) => ({ label: entry.name, value: entry.id })))

const showForm = ref(false)
const saving = ref(false)
const formError = ref('')
type RelationForm = { id: string | null, updatedAt: string | null, mine: boolean, otherId: string | undefined, type: string, label: string, otherLabel: string, description: string, visible: boolean, otherVisible: boolean }
const emptyForm = (): RelationForm => ({ id: null, updatedAt: null, mine: true, otherId: undefined, type: 'family', label: '', otherLabel: '', description: '', visible: false, otherVisible: false })
const form = ref(emptyForm())
const otherName = computed(() => others.value.find((entry) => entry.id === form.value.otherId)?.name || '')

function startCreate() {
  form.value = emptyForm()
  formError.value = ''
  showForm.value = true
}

// Le formulaire est toujours vu du personnage de la page ; « mine » dit de quel côté de la relation il est
function startEdit(side: ReturnType<typeof relationSide<Relation>>) {
  const relation = side.relation
  form.value = {
    id: relation.id,
    updatedAt: relation.updatedAt,
    mine: relation.fromCharacterId === props.character.id,
    otherId: side.other?.id,
    type: relation.type,
    label: side.label || '',
    otherLabel: side.otherLabel || '',
    description: relation.description || '',
    visible: side.visible,
    otherVisible: relation.fromCharacterId === props.character.id ? relation.toVisible : relation.fromVisible
  }
  formError.value = ''
  showForm.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  const here = { characterId: props.character.id, label: form.value.label, visible: form.value.visible }
  const there = { characterId: form.value.otherId, label: form.value.otherLabel, visible: form.value.otherVisible }
  const [from, to] = form.value.mine ? [here, there] : [there, here]
  const body = {
    type: form.value.type,
    description: form.value.description,
    fromCharacterId: from.characterId,
    fromLabel: from.label,
    fromVisible: from.visible,
    toCharacterId: to.characterId,
    toLabel: to.label,
    toVisible: to.visible,
    // Version lue : une modification faite entre-temps par quelqu'un d'autre est refusée
    ...(form.value.id ? { updatedAt: form.value.updatedAt } : {})
  }
  try {
    await useApiFetch(form.value.id ? `/api/character-relations/${form.value.id}` : '/api/character-relations', { method: form.value.id ? 'PUT' : 'POST', body })
    showForm.value = false
    await load()
  } catch (err) {
    formError.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}

async function remove(relation: Relation) {
  if (!confirm('Supprimer cette relation ? Elle disparaît aussi de la fiche de l’autre personnage.')) return
  try {
    await useApiFetch(`/api/character-relations/${relation.id}`, { method: 'DELETE', headers: { 'if-unmodified-since': new Date(relation.updatedAt).toISOString() } })
    await load()
  } catch (err) {
    message.value = apiErrorMessage(err, 'Suppression impossible')
  }
}
</script>
