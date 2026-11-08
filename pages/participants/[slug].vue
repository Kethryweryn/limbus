<template>
  <div v-if="participant" class="p-6 max-w-7xl mx-auto space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UButton to="/participants" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
        Participants
      </UButton>
      <div v-if="!isEditing" class="flex gap-2">
        <UButton
          :href="`/api/participants/${participant.id}/export`"
          external
          download
          icon="i-heroicons-arrow-down-tray"
          color="neutral"
          variant="outline"
          title="Toutes ses données dans vos jeux (demande d’accès RGPD)"
        >
          Exporter ses données
        </UButton>
        <UButton
          icon="i-heroicons-pencil-square"
          color="primary"
          @click="startEdit"
        >
          Modifier
        </UButton>
      </div>
    </div>

    <ParticipantForm
      v-if="isEditing && editableParticipant"
      v-model:participant="editableParticipant"
      :games="games || []"
      mode="edit"
      @submit="saveParticipant"
      @cancel="cancelEdit"
    />

    <template v-else>
      <h1 class="text-3xl font-bold">{{ participant.name }}</h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UCard>
          <template #header>Coordonnées</template>
          <div class="space-y-3 text-sm">
            <div>
              <span class="text-gray-500">Email</span>
              <div>{{ participant.email || 'Non renseigné' }}</div>
            </div>
            <div>
              <span class="text-gray-500">Téléphone</span>
              <div>{{ participant.phone || 'Non renseigné' }}</div>
            </div>
          </div>
        </UCard>

        <!-- Contact d'urgence et allergies, tenus par la personne : lus, jamais modifiés ici (R1b, US-178) -->
        <UCard>
          <template #header>Urgence et allergies</template>
          <!-- Une lecture ratée ne doit pas se lire comme « rien de déclaré » -->
          <p v-if="emergencyError" class="text-sm text-gray-600">
            Lecture impossible pour l’instant : rechargez la page pour voir son contact d’urgence et ses allergies.
          </p>
          <div v-else class="space-y-3 text-sm">
            <!-- Nom et téléphone sur deux lignes nommées, pour qu'un nom ne se confonde pas avec le libellé (US-182) -->
            <div>
              <span class="text-gray-500">Contact d’urgence : nom</span>
              <div>{{ emergency?.emergencyContactName?.trim() || 'Non renseigné' }}</div>
            </div>
            <div>
              <span class="text-gray-500">Contact d’urgence : téléphone</span>
              <div>{{ emergency?.emergencyContactPhone?.trim() || 'Non renseigné' }}</div>
            </div>
            <div>
              <span class="text-gray-500">Allergies et régime</span>
              <div class="whitespace-pre-line">{{ emergency?.dietary?.trim() || 'Non renseigné' }}</div>
            </div>
            <p v-if="emergency?.source" class="text-xs text-gray-500">
              {{ emergency.source === 'registration' ? `D’après son inscription à ${emergency.gameTitle}.` : 'D’après son compte.' }}
            </p>
          </div>
        </UCard>

        <!-- Chaque jeu avec les sessions où la personne a un rôle ou un personnage, chacune vers sa page (R1c, US-183) -->
        <UCard>
          <template #header>Jeux et sessions</template>
          <div v-if="shownGames.length" class="space-y-3 text-sm">
            <div v-for="game in shownGames" :key="game.id">
              <div class="font-medium">{{ game.title }}</div>
              <ul v-if="sessionsOf(game.id).length" class="mt-1 space-y-1">
                <li v-for="session in sessionsOf(game.id)" :key="session.id">
                  <NuxtLink :to="`/sessions/${session.slug}`" class="text-primary hover:underline">{{ session.name }}</NuxtLink>
                  <span class="text-gray-500">{{ sessionDetails(session) }}</span>
                </li>
              </ul>
              <p v-else class="text-gray-500">Aucune session</p>
            </div>
          </div>
          <span v-else class="text-sm text-gray-500">Aucun jeu</span>
        </UCard>

        <!-- Refus de l'usage de sa photo (US-109) : posé ou levé à la demande de la personne -->
        <UCard>
          <template #header>Photo</template>
          <p v-if="participant.photoRefusedAt" class="text-sm text-gray-600">
            Photo refusée depuis le {{ new Date(participant.photoRefusedAt).toLocaleDateString('fr-FR') }} : aucune photo de cette personne dans le cast ni les trombinoscopes.
          </p>
          <p v-else class="text-sm text-gray-600">Cette personne n’a pas refusé l’usage de sa photo.</p>
          <p v-if="participant.photoRefusedAt && participant.userId" class="mt-2 text-xs text-gray-500">
            Elle a un compte : elle seule peut lever ce refus, depuis « Mon compte ».
          </p>
          <div class="mt-3 flex items-center gap-3">
            <UButton
              v-if="!participant.photoRefusedAt || !participant.userId"
              size="sm"
              color="neutral"
              variant="soft"
              :loading="photoSaving"
              @click="setPhotoRefusal(!participant.photoRefusedAt)"
            >
              {{ participant.photoRefusedAt ? 'Lever le refus' : 'Noter un refus de photo' }}
            </UButton>
            <span v-if="photoMessage" class="text-sm text-gray-500">{{ photoMessage }}</span>
          </div>
        </UCard>
      </div>

      <!-- Une note par jeu, des seuls jeux accessibles (US-069) -->
      <div v-for="game in gamesWithNotes" :key="game.id">
        <h2 class="text-xl font-semibold mb-2">Notes — {{ game.title }}</h2>
        <p class="whitespace-pre-line">{{ participant.gameNotes[game.id] }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { apiErrorMessage, pageLoadError } from '~/utils/apiErrors'
import { formatLongDate, PARIS_TIME_ZONE } from '~/utils/dates'
import { SESSION_ROLE_LABELS, SESSION_ROLES } from '~/utils/domain'
import { withQueuedEdit, type ParticipantDraft } from '~/utils/writingDrafts'
import type { ApiResponse } from '~/composables/useApiFetch'

type Participant = ApiResponse<'/api/participants/:id'>

const route = useRoute()
const router = useRouter()
const { data: participant, error, refresh } = await useFetch(`/api/participants/slug/${route.params.slug}`)
const { data: games } = await useFetch('/api/games')
const photoSaving = ref(false)
const photoMessage = ref('')

async function setPhotoRefusal(refused: boolean) {
  if (!participant.value) return
  if (refused && !confirm('Noter que cette personne refuse l’usage de sa photo ? Ses photos du cast seront supprimées.')) return
  photoSaving.value = true
  photoMessage.value = ''
  try {
    await useApiAction(`/api/participants/${participant.value.id}/photo-refusal`, { method: 'POST', body: { refused } })
    await refresh()
  } catch (err) {
    photoMessage.value = apiErrorMessage(err, 'L’enregistrement a échoué.')
  } finally {
    photoSaving.value = false
  }
}

if (error.value) {
  handleApiAuthError(error.value)
  throw pageLoadError(error.value, 'Participant introuvable')
}

// Lu à part de la fiche (R1b) : la liste, les assistants et le cache hors ligne ne reçoivent pas ces données
const { data: emergency, error: emergencyError } = await useFetch(`/api/participants/${participant.value?.id}/emergency`)

type ParticipantSession = ApiResponse<'/api/participants/:id/sessions'>[number]
const { data: sessions } = await useFetch(`/api/participants/${participant.value?.id}/sessions`)
const sessionsOf = (gameId: string) => (sessions.value || []).filter((session) => session.gameId === gameId)
// Date, puis ses personnages et ses rôles ; « Participant » seulement sans personnage, qui le dit déjà
function sessionDetails(session: ParticipantSession) {
  const roles = session.roles
    .filter((role) => !(role === SESSION_ROLES.participant && session.characters.length))
    .map((role) => SESSION_ROLE_LABELS[role as keyof typeof SESSION_ROLE_LABELS] ?? role)
  return [session.date ? formatLongDate(session.date, PARIS_TIME_ZONE) : null, ...session.characters, ...roles]
    .filter(Boolean)
    .map((part) => ` · ${part}`)
    .join('')
}

const { isEditing, draft: editableParticipant, startEdit, cancelEdit, closeAfterSave } = useSheetEdit(() => participant.value ? normalizeParticipantForForm(participant.value) : null)

// Jeux d'un enregistrement mis en file hors ligne (ADR-0036) : la fiche les montre jusqu'à la relecture
const queuedGameIds = ref<string[] | null>(null)
const shownGames = computed(() => {
  const ids = queuedGameIds.value
  return ids ? (games.value || []).filter((game) => ids.includes(game.id)) : participant.value?.games || []
})
const gamesWithNotes = computed(() => shownGames.value.filter((game) => participant.value?.gameNotes[game.id]))

function normalizeParticipantForForm(value: Participant): ParticipantDraft {
  return {
    ...value,
    gameIds: value.games.map((game) => game.id)
  }
}

async function saveParticipant() {
  if (!editableParticipant.value?.id) return

  const saved = await useApiFetch(`/api/participants/${editableParticipant.value.id}`, {
    method: 'PUT',
    body: editableParticipant.value
  })
  if (isOfflineQueued(saved)) {
    if (participant.value) participant.value = withQueuedEdit(participant.value, editableParticipant.value)
    queuedGameIds.value = editableParticipant.value.gameIds ?? null
    cancelEdit()
    return
  }
  // Fiche sans aucun jeu : supprimée par le serveur (US-036)
  if ('deleted' in saved) {
    await router.replace('/participants')
    return
  }
  participant.value = saved
  queuedGameIds.value = null
  await closeAfterSave(`/participants/${saved.slug}`, refresh)
}
</script>

