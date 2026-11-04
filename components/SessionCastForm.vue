<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">Cast</h2>
          <p class="text-sm text-gray-500">{{ assignments.length }} personnage(s)</p>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-heroicons-sparkles"
          :loading="assistantLoading"
          @click="runAssistant"
        >
          Proposer une répartition
        </UButton>
      </div>
    </template>

    <p v-if="assistantMessage" class="mb-4 text-sm text-primary-600">{{ assistantMessage }}</p>

    <form class="space-y-4" @submit.prevent="submit">
      <div v-if="totalPages > 1" class="flex justify-end">
        <span v-if="totalPages > 1" class="text-sm text-gray-500">
          {{ paginationStart + 1 }}-{{ paginationEnd }} / {{ sortedAssignments.length }}
        </span>
      </div>

      <div
        v-for="(assignment, index) in paginatedAssignments"
        :key="assignment.characterId"
        class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start rounded border border-gray-200 p-3"
      >
        <div class="lg:col-span-3 min-w-0">
          <div class="flex items-center gap-2">
            <UBadge color="warning" variant="subtle" size="xs">
              {{ characterById(assignment.characterId)?.type === CHARACTER_TYPES.pnj ? 'PNJ' : 'PJ' }}
            </UBadge>
            <span class="font-medium truncate">{{ characterById(assignment.characterId)?.name || 'Personnage inconnu' }}</span>
          </div>
          <p v-if="hasGroups" class="mt-1 text-xs text-gray-500 truncate">
            {{ characterGroupLabel(characterById(assignment.characterId)) }}
          </p>
        </div>
        <div class="lg:col-span-3 flex items-start gap-2">
          <UButton
            v-if="characterById(assignment.characterId)?.type !== CHARACTER_TYPES.pnj"
            type="button"
            size="sm"
            :color="assignment.locked ? 'primary' : 'neutral'"
            :variant="assignment.locked ? 'solid' : 'ghost'"
            :icon="assignment.locked ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'"
            :aria-label="assignment.locked ? 'Déverrouiller' : 'Verrouiller'"
            :title="assignment.locked ? 'Verrouillée : l’assistant n’y touche pas' : 'Verrouiller cette attribution'"
            @click="assignment.locked = !assignment.locked"
          />
          <div class="min-w-0 flex-1">
            <USelect
              :model-value="choiceOf(assignment)"
              :items="participantOptionsForAssignment(assignment)"
              value-key="value"
              placeholder="Participant"
              class="w-full"
              @update:model-value="(value) => setChoice(assignment, value)"
            />
            <p v-if="assignment.reservedRegistrationId" class="mt-1 text-xs text-warning-600">
              Réservé, en attente de confirmation
            </p>
          </div>
        </div>
        <!-- Refus de l'usage de sa photo (US-109) : pas de photo pour cette personne -->
        <p v-if="photoRefused(assignment)" class="lg:col-span-3 text-sm text-gray-500">
          Photo refusée par la personne
        </p>
        <div v-else class="lg:col-span-3 flex items-center gap-3">
          <button
            type="button"
            class="size-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center"
            :disabled="uploadingIndex === index"
            @click="assignment.photoUrl ? openPhotoPreview(assignment.photoUrl) : openFilePicker(index)"
          >
            <img
              v-if="assignment.photoUrl"
              :src="assignment.photoUrl"
              alt=""
              class="h-full w-full object-cover"
            >
            <UIcon v-else name="i-heroicons-camera" class="size-8 text-gray-400" />
          </button>

          <div class="min-w-0 space-y-1">
            <input
              :ref="(el) => setFileInputRef(el, index)"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              :disabled="uploadingIndex === index"
              @change="uploadAssignmentPhoto($event, assignment, index)"
            >
            <UButton
              type="button"
              size="xs"
              color="neutral"
              variant="subtle"
              :loading="uploadingIndex === index"
              @click="openFilePicker(index)"
            >
              {{ assignment.photoUrl ? 'Changer la photo' : 'Ajouter une photo' }}
            </UButton>
            <p class="text-xs text-gray-500 truncate">
              {{ photoLabel(assignment, index) }}
            </p>
          </div>
        </div>
        <UInput v-model="assignment.notes" placeholder="Notes" class="lg:col-span-2" />
        <div class="lg:col-span-1" />
      </div>

      <div v-if="!assignments.length" class="rounded border border-dashed border-gray-300 p-6 text-sm text-gray-500">
        Aucun personnage dans ce jeu.
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-center gap-4">
        <UButton type="button" color="neutral" variant="soft" :disabled="currentPage === 1" @click="currentPage--">
          Précédent
        </UButton>
        <span class="inline-flex items-center text-sm text-gray-500">
          Page {{ currentPage }} / {{ totalPages }}
        </span>
        <UButton type="button" color="neutral" variant="soft" :disabled="currentPage === totalPages" @click="currentPage++">
          Suivant
        </UButton>
      </div>

      <div class="flex gap-2">
        <UButton type="submit" color="primary" :loading="saving" :disabled="saving">
          Enregistrer le cast
        </UButton>
        <UButton type="button" color="neutral" variant="soft" to="/sessions">Retour</UButton>
      </div>

      <p v-if="serverError" class="text-red-500 text-sm">{{ serverError }}</p>
    </form>

    <UModal v-model:open="showAssistant" title="Proposition de répartition" :ui="{ content: 'sm:max-w-4xl' }">
      <template #body>
        <div v-if="assistant" class="space-y-5 text-sm">
          <UAlert
            v-if="assistant.lockedConflicts.length || assistant.avoidWarnings.length"
            color="warning"
            variant="subtle"
            title="À vérifier"
          >
            <template #description>
              <ul class="list-disc pl-4">
                <li v-for="line in [...assistant.lockedConflicts, ...assistant.avoidWarnings]" :key="line">{{ line }}</li>
              </ul>
            </template>
          </UAlert>

          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="text-xs text-gray-500">
                <tr>
                  <th class="py-1 pr-3">Personnage</th>
                  <th class="py-1 pr-3">Proposition</th>
                  <th class="py-1 pr-3">Note</th>
                  <th class="py-1">Détail</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in assistant.proposal" :key="line.characterId" class="border-t border-gray-100 align-top">
                  <td class="py-2 pr-3 font-medium">{{ assistantCharacterName(line.characterId) }}</td>
                  <td class="py-2 pr-3">
                    <span>{{ line.playerId ? assistantPlayerName(line.playerId) : '—' }}</span>
                    <UBadge v-if="line.locked" color="neutral" variant="subtle" size="xs" class="ml-1">verrouillée</UBadge>
                    <UBadge v-else-if="line.reservedRegistrationId" color="warning" variant="subtle" size="xs" class="ml-1">à confirmer</UBadge>
                  </td>
                  <td class="py-2 pr-3">{{ formatScore(line.score) }}</td>
                  <td class="py-2 text-xs text-gray-500">
                    <p v-for="component in line.components" :key="component.label">{{ component.label }} (+{{ formatScore(component.points) }})</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="assistant.unplaced.length">
            <h3 class="font-medium">Sans personnage</h3>
            <ul class="list-disc pl-4">
              <li v-for="line in assistant.unplaced" :key="line.playerId">{{ assistantPlayerName(line.playerId) }} : {{ line.reason }}</li>
            </ul>
          </div>

          <div v-if="playersWithRefusedTexts.length">
            <h3 class="font-medium">Relations refusées, en texte libre</h3>
            <ul class="list-disc pl-4">
              <li v-for="player in playersWithRefusedTexts" :key="player.id">{{ player.name }} : {{ player.refusedTexts.join(' ; ') }}</li>
            </ul>
          </div>

          <div>
            <h3 class="font-medium">Notes par joueur</h3>
            <details v-for="player in assistant.players" :key="player.id" class="mt-1">
              <summary class="cursor-pointer">
                {{ player.name }}
                <span v-if="player.reservedRegistrationId" class="text-xs text-warning-600">(en attente de confirmation)</span>
                <span v-if="!player.hasAnswers" class="text-xs text-gray-500">(pas de réponses au questionnaire)</span>
              </summary>
              <ul class="mt-1 space-y-1 pl-4">
                <li v-for="pair in assistant.pairs[player.id]" :key="pair.characterId">
                  <span :class="pair.blocks.length ? 'text-red-600 line-through' : ''">{{ assistantCharacterName(pair.characterId) }}</span>
                  — {{ formatScore(pair.score) }}
                  <span v-for="component in pair.components" :key="component.label" class="block text-xs text-gray-500">{{ component.label }} (+{{ formatScore(component.points) }})</span>
                  <span v-for="block in pair.blocks" :key="block" class="block text-xs text-red-600">Interdit : {{ block }}</span>
                </li>
              </ul>
            </details>
          </div>

          <div class="flex gap-2">
            <UButton type="button" color="primary" @click="applyProposal">Appliquer la proposition</UButton>
            <UButton type="button" color="neutral" variant="soft" @click="showAssistant = false">Fermer</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showPhotoPreview">
      <template #body>
        <div class="flex justify-center p-2">
          <img
            v-if="previewPhotoUrl"
            :src="previewPhotoUrl"
            alt=""
            class="max-h-[80vh] max-w-full rounded object-contain"
          >
        </div>
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import { formatScore } from '~/utils/castingAssistant'
import { computed, ref, watch } from 'vue'
import { CHARACTER_TYPES, SESSION_ROLES } from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { CharacterOption } from '~/utils/writingDrafts'

type Link = { id: string } | null
/** Ligne du cast éditée : un personnage, sa personne ou sa réservation (US-100), son cadenas (US-101). */
export type CastLine = { characterId: string, participantId: string, reservedRegistrationId: string, locked: boolean, photoUrl: string, notes: string }

const props = defineProps<{
  // Session lue, ou projetée hors ligne (US-048)
  session: {
    id: string
    gameId: string
    participants?: Array<{ role: string, participantId?: string | null, participant?: Link }>
    assignments?: Array<{ characterId?: string, participantId?: string | null, reservedRegistrationId?: string | null, locked?: boolean, photoUrl?: string | null, notes?: string | null, character?: Link, participant?: Link }>
    retainedRegistrations?: Array<{ id: string, name: string }>
  }
  characters: Array<CharacterOption & { factions?: Array<{ name: string }> }>
  participants: Array<{ id: string, name: string, email?: string | null, photoRefusedAt?: string | null, games?: Array<{ id: string }> }>
  onSave: (assignments: CastLine[]) => Promise<unknown>
}>()

const assignments = ref<CastLine[]>([])
const uploadingIndex = ref<number | null>(null)
const saving = ref(false)
const serverError = ref('')
const fileInputs = ref<HTMLInputElement[]>([])
const selectedPhotoNames = ref<Record<number, string>>({})
const showPhotoPreview = ref(false)
const previewPhotoUrl = ref('')
const currentPage = ref(1)
const itemsPerPage = 25

const sessionCharacters = computed(() => props.characters
  .filter((character) => character.gameId === props.session.gameId)
  .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === CHARACTER_TYPES.pj ? -1 : 1)))

const hasGroups = computed(() => sessionCharacters.value.some((character) => character.factions?.length))

const sortedAssignments = computed(() => [...assignments.value].sort((a, b) => {
  const characterA = characterById(a.characterId)
  const characterB = characterById(b.characterId)
  if (!characterA || !characterB) return 0

  if (hasGroups.value) {
    const groupCompare = characterGroupLabel(characterA).localeCompare(characterGroupLabel(characterB))
    if (groupCompare !== 0) return groupCompare
  }

  if (characterA.type !== characterB.type) {
    return characterA.type === CHARACTER_TYPES.pj ? -1 : 1
  }
  return characterA.name.localeCompare(characterB.name)
}))

const totalPages = computed(() => Math.max(1, Math.ceil(sortedAssignments.value.length / itemsPerPage)))
const paginationStart = computed(() => (currentPage.value - 1) * itemsPerPage)
const paginationEnd = computed(() => Math.min(paginationStart.value + itemsPerPage, sortedAssignments.value.length))
const paginatedAssignments = computed(() => sortedAssignments.value.slice(paginationStart.value, paginationEnd.value))

const participantOptions = computed(() => [
  { label: 'Aucun participant', value: '' },
  ...props.participants
    .filter((participant) => participant.games?.some((game) => game.id === props.session.gameId))
    .map((participant) => ({
      label: participant.email ? `${participant.name} - ${participant.email}` : participant.name,
      value: participant.id
    }))
])

const pnjCastableIds = computed(() => new Set(
  props.session.participants
    ?.filter((participant) => participant.role === SESSION_ROLES.organizer || participant.role === SESSION_ROLES.npc)
    .map((participant) => participant.participantId || participant.participant?.id)
    .filter((id): id is string => Boolean(id)) || []
))

function photoRefused(assignment: CastLine) {
  return Boolean(assignment.participantId && props.participants.find((participant) => participant.id === assignment.participantId)?.photoRefusedAt)
}

function characterById(characterId: string) {
  return props.characters.find((character) => character.id === characterId)
}

function characterGroupLabel(character: { factions?: Array<{ name: string }> } | undefined) {
  return character?.factions?.[0]?.name || 'Sans groupe'
}

// Personnes retenues non confirmées : un PJ leur est réservé, sans les faire entrer dans le cast (US-100)
const RESERVATION_PREFIX = 'reservation:'
const retainedRegistrations = computed(() => props.session.retainedRegistrations || [])
const reservationOptions = computed(() => retainedRegistrations.value.map((registration) => ({
  label: `${registration.name} (retenue, en attente de confirmation)`,
  value: `${RESERVATION_PREFIX}${registration.id}`
})))

function participantOptionsForAssignment(assignment: CastLine) {
  const character = characterById(assignment.characterId)
  if (character?.type !== CHARACTER_TYPES.pnj) return [...participantOptions.value, ...reservationOptions.value]

  return participantOptions.value.filter((participant) => !participant.value || pnjCastableIds.value.has(participant.value))
}

function choiceOf(assignment: CastLine) {
  return assignment.reservedRegistrationId ? `${RESERVATION_PREFIX}${assignment.reservedRegistrationId}` : assignment.participantId
}

function setChoice(assignment: CastLine, value: string | null) {
  const reserved = typeof value === 'string' && value.startsWith(RESERVATION_PREFIX)
  assignment.reservedRegistrationId = reserved ? value.slice(RESERVATION_PREFIX.length) : ''
  assignment.participantId = reserved ? '' : value || ''
}

// Assistant de casting (US-101, US-102) : calculé sur le formulaire en cours, appliqué seulement à la demande
const showAssistant = ref(false)
const assistant = ref<ApiResponse<'/api/sessions/:id/casting-assistant', 'post'> | null>(null)
const assistantLoading = ref(false)
const assistantMessage = ref('')

const playersWithRefusedTexts = computed(() => assistant.value?.players.filter((player) => player.refusedTexts.length) || [])

function assistantCharacterName(characterId: string) {
  return assistant.value?.characters.find((character) => character.id === characterId)?.name || characterById(characterId)?.name || '?'
}

function assistantPlayerName(playerId: string) {
  return assistant.value?.players.find((player) => player.id === playerId)?.name || '?'
}

async function runAssistant() {
  assistantLoading.value = true
  assistantMessage.value = ''
  serverError.value = ''
  try {
    assistant.value = await useApiAction(`/api/sessions/${props.session.id}/casting-assistant`, {
      method: 'POST',
      body: {
        assignments: assignments.value.map(({ characterId, participantId, reservedRegistrationId, locked }) => ({ characterId, participantId, reservedRegistrationId, locked }))
      }
    })
    showAssistant.value = true
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'L’assistant n’a pas pu calculer de proposition')
  } finally {
    assistantLoading.value = false
  }
}

// Remplit les lignes non verrouillées ; rien n'est enregistré avant « Enregistrer le cast »
function applyProposal() {
  const rows = new Map(assignments.value.map((assignment) => [assignment.characterId, assignment]))
  for (const line of assistant.value?.proposal || []) {
    const row = rows.get(line.characterId)
    if (!row || row.locked) continue
    const participantId = line.reservedRegistrationId ? '' : line.playerId || ''
    const reservedRegistrationId = line.reservedRegistrationId || ''
    if (row.participantId === participantId && row.reservedRegistrationId === reservedRegistrationId) continue
    row.participantId = participantId
    row.reservedRegistrationId = reservedRegistrationId
    // La photo était celle de la personne remplacée
    row.photoUrl = ''
  }
  showAssistant.value = false
  assistantMessage.value = 'Proposition appliquée : vérifiez le cast, puis enregistrez-le.'
}

watch([() => props.session, sessionCharacters], ([session]) => {
  const assignmentsByCharacterId = new Map((session.assignments || []).map((assignment) => [
    assignment.characterId || assignment.character?.id,
    assignment
  ]))

  assignments.value = sessionCharacters.value.map((character) => {
    const assignment = assignmentsByCharacterId.get(character.id)
    return {
      characterId: character.id,
      participantId: assignment?.participantId || assignment?.participant?.id || '',
      reservedRegistrationId: assignment?.reservedRegistrationId || '',
      locked: Boolean(assignment?.locked),
      photoUrl: assignment?.photoUrl || '',
      notes: assignment?.notes || ''
    }
  })
  selectedPhotoNames.value = {}
  currentPage.value = 1
}, { immediate: true })

watch(totalPages, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
  if (currentPage.value < 1) currentPage.value = 1
})

function setFileInputRef(element: unknown, index: number) {
  if (element instanceof HTMLInputElement) {
    fileInputs.value[index] = element
  }
}

function openFilePicker(index: number) {
  fileInputs.value[index]?.click()
}

function photoLabel(assignment: CastLine, index: number) {
  if (uploadingIndex.value === index) return 'Envoi en cours...'
  if (selectedPhotoNames.value[index]) return selectedPhotoNames.value[index]
  if (assignment.photoUrl) return 'Photo enregistrée'
  return 'Aucune photo'
}

function openPhotoPreview(photoUrl: string) {
  previewPhotoUrl.value = photoUrl
  showPhotoPreview.value = true
}

async function submit() {
  if (saving.value) return

  saving.value = true
  try {
    // Une personne qui a refusé l'usage de sa photo ne garde pas celle de la ligne (US-109)
    await props.onSave(assignments.value
      .filter((assignment) => assignment.characterId)
      .map((assignment) => photoRefused(assignment) ? { ...assignment, photoUrl: '' } : assignment))
    serverError.value = ''
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Erreur inconnue')
  } finally {
    saving.value = false
  }
}

async function uploadAssignmentPhoto(event: Event, assignment: CastLine, index: number) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingIndex.value = index
  selectedPhotoNames.value = {
    ...selectedPhotoNames.value,
    [index]: file.name
  }
  try {
    const formData = new FormData()
    formData.append('photo', file)
    formData.append('sessionId', props.session.id)
    const result = await useApiAction('/api/uploads/session-assignment-photos', {
      method: 'POST',
      body: formData
    })
    assignment.photoUrl = result.photoUrl
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Impossible d’envoyer la photo')
  } finally {
    uploadingIndex.value = null
    input.value = ''
  }
}
</script>
