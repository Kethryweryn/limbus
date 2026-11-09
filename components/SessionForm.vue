<template>
  <UCard class="w-full">
    <template #header>
      {{ mode === 'edit' ? 'Modifier la session' : 'Créer une session' }}
    </template>

    <form class="w-full space-y-6" @submit.prevent="submit">
      <UFormField label="Jeu" :error="errors.gameId">
        <USelect
          v-model="localSession.gameId"
          :items="gameOptions"
          value-key="value"
          placeholder="Choisissez un jeu"
          required
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Nom" :error="errors.name">
        <UInput v-model="localSession.name" required size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Statut">
        <USelect
          v-model="localSession.status"
          :items="statusOptions"
          value-key="value"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Date">
        <UInput v-model.nullable="localSession.date" type="datetime-local" size="lg" class="w-full" />
      </UFormField>

      <AppCheckboxRow
        v-model="localSession.published"
        label="Visible sur la page publique"
        description="La session pourra apparaître sur la page publique du jeu, quand celle-ci montrera les sessions à venir."
      />

      <UFormField label="Lieu">
        <USelect
          v-model="locationIdModel"
          :items="locationOptions"
          value-key="value"
          placeholder="Choisissez un lieu"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UFormField label="Organisateurs">
          <USelectMenu
            v-model="localSession.organizerIds"
            :items="sessionParticipantOptions"
            value-key="value"
            multiple
            :disabled="!sessionParticipantOptions.length"
            placeholder="Sélectionner les organisateurs"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="PNJ de session">
          <USelectMenu
            v-model="localSession.npcIds"
            :items="sessionParticipantOptions"
            value-key="value"
            multiple
            :disabled="!sessionParticipantOptions.length"
            placeholder="Sélectionner les PNJ"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Équipe cuisine">
          <USelectMenu
            v-model="localSession.kitchenIds"
            :items="sessionParticipantOptions"
            value-key="value"
            multiple
            :disabled="!sessionParticipantOptions.length"
            placeholder="Sélectionner l’équipe cuisine"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>

      <div class="flex flex-wrap gap-2 pt-2">
        <UButton type="submit" color="primary" size="lg">
          {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
        </UButton>
        <UButton type="button" color="neutral" variant="soft" size="lg" @click="$emit('cancel')">
          Annuler
        </UButton>
      </div>

      <p v-if="serverError" class="text-red-500 text-sm mt-2">{{ serverError }}</p>
    </form>
  </UCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CHARACTER_TYPES, SESSION_ROLES, SESSION_STATUS_OPTIONS } from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import { noneOption } from '~/utils/selectOptions'
import { emptyStringModel, type CharacterOption, type GameOption, type SessionDraft } from '~/utils/writingDrafts'

// Détails d'une session : nom, date, lieu, statut, équipe. Le cast se distribue dans son onglet (SessionCastForm).
const props = withDefaults(defineProps<{
  // Enregistrement par le parent (`@submit`), attendu pour afficher ici son erreur
  onSubmit: () => unknown
  session: SessionDraft
  games: GameOption[]
  characters: CharacterOption[]
  locations: Array<{ id: string, name: string, address?: string | null, gameId: string }>
  participants: Array<{ id: string, name: string, email?: string | null, games?: Array<{ id: string }> }>
  mode?: 'create' | 'edit'
}>(), { mode: 'create' })

const emit = defineEmits<{ cancel: [], 'update:session': [session: SessionDraft] }>()

const localSession = ref<SessionDraft>({ ...props.session })
const errors = ref<Record<string, string>>({})
const serverError = ref('')

const gameOptions = computed(() => props.games.map((game) => ({
  label: game.title,
  value: game.id
})))

// « Aucun lieu » vaut une chaîne vide
const locationIdModel = emptyStringModel(localSession, 'locationId')

const statusOptions: Array<{ label: string, value: string }> = [...SESSION_STATUS_OPTIONS]

const locationOptions = computed(() => [
  noneOption('Aucun lieu'),
  ...props.locations
    .filter((location) => !localSession.value.gameId || location.gameId === localSession.value.gameId)
    .map((location) => ({
      label: location.address ? `${location.name} - ${location.address}` : location.name,
      value: location.id
    }))
])

const sessionParticipantOptions = computed(() => [
  ...props.participants
    .filter((participant) => !localSession.value.gameId || participant.games?.some((game) => game.id === localSession.value.gameId))
    .map((participant) => ({
      label: participant.email ? `${participant.name} - ${participant.email}` : participant.name,
      value: participant.id
    }))
])

const selectedOrganizerIds = computed(() => new Set(localSession.value.organizerIds || []))
const selectedNpcIds = computed(() => new Set(localSession.value.npcIds || []))
const pnjCastableIds = computed(() => new Set([
  ...selectedOrganizerIds.value,
  ...selectedNpcIds.value
]))

function characterById(characterId: string) {
  return props.characters.find((character) => character.id === characterId)
}

function sessionRoleIds(session: SessionDraft, role: string) {
  return session.participants
    ?.filter((participant) => participant.role === role)
    .map((participant) => participant.participantId || participant.participant?.id)
    .filter((id): id is string => Boolean(id)) || []
}

function sessionParticipantsPayload(session: SessionDraft) {
  const explicitParticipants = [
    ...(session.organizerIds || []).map((participantId) => ({ participantId, role: SESSION_ROLES.organizer })),
    ...(session.npcIds || []).map((participantId) => ({ participantId, role: SESSION_ROLES.npc })),
    ...(session.kitchenIds || []).map((participantId) => ({ participantId, role: SESSION_ROLES.kitchen }))
  ]
  const explicitIds = new Set(explicitParticipants.map((participant) => participant.participantId))
  // Les joueurs restent, même sans personnage : ils sont entrés par le vivier, pas par ce formulaire
  const playerIds = [...new Set([
    ...sessionRoleIds(session, SESSION_ROLES.participant),
    ...(session.assignments || []).map((assignment) => assignment.participantId)
  ].filter((participantId): participantId is string => Boolean(participantId && !explicitIds.has(participantId))))]
  const players = playerIds.map((participantId) => ({ participantId, role: SESSION_ROLES.participant }))

  return [...explicitParticipants, ...players]
}

watch(() => props.session, (newSession) => {
  localSession.value = {
    ...newSession,
    organizerIds: newSession.organizerIds || sessionRoleIds(newSession, SESSION_ROLES.organizer),
    npcIds: newSession.npcIds || sessionRoleIds(newSession, SESSION_ROLES.npc),
    kitchenIds: newSession.kitchenIds || sessionRoleIds(newSession, SESSION_ROLES.kitchen),
    // Le cast est repris tel quel : enregistrer les détails ne le change pas
    assignments: newSession.assignments?.map((assignment) => ({
      characterId: assignment.characterId || assignment.character?.id || '',
      participantId: assignment.participantId || assignment.participant?.id || '',
      photoUrl: assignment.photoUrl || '',
      notes: assignment.notes || ''
    })) || []
  }
  errors.value = {}
  serverError.value = ''
}, { immediate: true })

watch(() => localSession.value.gameId, () => {
  localSession.value.assignments = localSession.value.assignments?.filter((assignment) =>
    props.characters.some((character) => character.id === assignment.characterId && character.gameId === localSession.value.gameId)
  ) || []
})

// Qui quitte l'organisation ou les PNJ perd ses PNJ, et aussi le PJ qu'il avait repris s'il n'est pas joueur (R31 de SPEC-018)
watch([() => localSession.value.organizerIds, () => localSession.value.npcIds], () => {
  const players = new Set(sessionRoleIds(localSession.value, SESSION_ROLES.participant))
  localSession.value.assignments = (localSession.value.assignments || []).map((assignment) => {
    const holder = assignment.participantId
    if (!holder || pnjCastableIds.value.has(holder)) return assignment
    const character = characterById(assignment.characterId || '')
    return character?.type === CHARACTER_TYPES.pnj || !players.has(holder)
      ? { ...assignment, participantId: '', photoUrl: '' }
      : assignment
  })
}, { deep: true })

function validate() {
  errors.value = {}
  if (!localSession.value.name?.trim()) {
    errors.value.name = 'Le nom est requis.'
  }
  if (!localSession.value.gameId) {
    errors.value.gameId = 'Le jeu est requis.'
  }
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return

  try {
    emit('update:session', {
      ...localSession.value,
      assignments: (localSession.value.assignments || []).filter((assignment) => assignment.characterId),
      participants: sessionParticipantsPayload(localSession.value)
    })
    await props.onSubmit()
    serverError.value = ''
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Erreur inconnue')
  }
}
</script>
