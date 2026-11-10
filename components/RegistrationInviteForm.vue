<template>
  <UModal v-model:open="open" title="Inviter à rejoindre le vivier">
    <template #body>
      <form class="space-y-5" novalidate @submit.prevent="submit">
        <p class="text-sm text-gray-500">
          Chaque personne reçoit par email un lien vers le questionnaire : elle entre dans le vivier en y répondant.
        </p>

        <UFormField
          label="Pour une session"
          description="Facultatif. La personne y sera inscrite si elle répond en se disant disponible. Aucune place n’est réservée à l’envoi."
        >
          <USelect v-model="sessionId" :items="sessionItems" value-key="value" class="w-full" />
        </UFormField>

        <UFormField label="Participants du jeu">
          <div class="space-y-2">
            <UInput
              v-model="search"
              icon="i-heroicons-magnifying-glass"
              placeholder="Rechercher"
              class="w-full"
            />
            <div class="max-h-64 space-y-1 overflow-y-auto">
              <AppCheckboxRow
                v-for="participant in visibleParticipants"
                :key="participant.id"
                :model-value="selected.includes(participant.id)"
                :label="participant.name"
                :description="participantDescription(participant)"
                :disabled="!canInvite(participant)"
                @update:model-value="toggle(participant.id, $event)"
              />
              <p v-if="!visibleParticipants.length" class="text-sm text-gray-500">
                Aucun participant de ce jeu ne correspond.
              </p>
            </div>
          </div>
        </UFormField>

        <UFormField label="Nouvelle personne" description="Si l’email correspond déjà à un participant de vos jeux, sa fiche est reprise.">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UInput v-model="newParticipant.name" placeholder="Nom" class="w-full" />
            <UInput v-model="newParticipant.email" type="email" placeholder="Email" class="w-full" />
          </div>
        </UFormField>

        <UAlert
          v-if="serverError"
          color="error"
          variant="soft"
          :description="serverError"
        />

        <div class="flex flex-wrap gap-2">
          <UButton type="submit" color="primary" :loading="saving" :disabled="!toInviteCount">
            Inviter{{ toInviteCount ? ` (${toInviteCount})` : '' }}
          </UButton>
          <UButton type="button" color="neutral" variant="soft" @click="open = false">
            Annuler
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { apiErrorMessage } from '~/utils/apiErrors'
import { REGISTRATION_STATUSES } from '~/utils/domain'
import { formatLongDate } from '~/utils/dates'
import { fetchByUrl, type ApiResponse } from '~/composables/useApiFetch'
import type { InvitationResult, RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

type Participant = ApiResponse<'/api/participants'>[number]

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  gameId: string
  period: RegistrationPeriod
  // Depuis le cast d'une session : cette session est déjà choisie
  initialSessionId?: string
}>()

const emit = defineEmits<{ invited: [result: InvitationResult] }>()

const participants = ref<Participant[]>([])
const selected = ref<string[]>([])
const search = ref('')
const newParticipant = reactive({ name: '', email: '' })
const serverError = ref('')
const saving = ref(false)

const NO_SESSION = 'aucune'
const sessionId = ref(NO_SESSION)
const sessions = ref<ApiResponse<'/api/registration-periods/:id/selection'>['sessions']>([])
const sessionItems = computed(() => [
  { label: 'Aucune : le vivier seulement', value: NO_SESSION },
  ...sessions.value.map((session) => ({ label: session.date ? `${session.name} · ${formatLongDate(session.date)}` : session.name, value: session.id }))
])

// Une seule ligne par personne dans le vivier ; qui a décliné ou en est sorti repart avec un nouveau lien
const peopleWithStatus = (keep: (status: string) => boolean) => props.period.registrations.filter((registration) => keep(registration.status)).map((registration) => registration.participant.id)
const registeredIds = computed(() => peopleWithStatus((status) => status !== REGISTRATION_STATUSES.withdrawn))
const withdrawnIds = computed(() => peopleWithStatus((status) => status === REGISTRATION_STATUSES.withdrawn))

watch(open, async (value) => {
  if (!value) return
  selected.value = []
  sessionId.value = props.initialSessionId ?? NO_SESSION
  search.value = ''
  newParticipant.name = ''
  newParticipant.email = ''
  serverError.value = ''
  try {
    const [people, overview] = await Promise.all([
      fetchByUrl<Participant[]>(`/api/participants?gameId=${encodeURIComponent(props.gameId)}`),
      useApiFetch(`/api/registration-periods/${props.period.id}/selection`)
    ])
    participants.value = people
    sessions.value = overview.sessions
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Impossible de charger les participants')
  }
}, { immediate: true }) // La modale est montée déjà ouverte au premier clic sur « Inviter »

const visibleParticipants = computed(() => {
  const query = search.value.trim().toLowerCase()
  return participants.value.filter((participant) => !query || participant.name.toLowerCase().includes(query))
})

const hasNewParticipant = computed(() => Boolean(newParticipant.name.trim() || newParticipant.email.trim()))
const toInviteCount = computed(() => selected.value.length + (hasNewParticipant.value ? 1 : 0))

function canInvite(participant: Participant) {
  return Boolean(participant.email?.trim()) && !registeredIds.value.includes(participant.id)
}

function participantDescription(participant: Participant) {
  if (registeredIds.value.includes(participant.id)) return 'Déjà dans le vivier, ou déjà invitée'
  if (!participant.email?.trim()) return 'Sans email : ajoutez-en un sur sa fiche pour l’inviter'
  if (withdrawnIds.value.includes(participant.id)) return `${participant.email} · a décliné ou est sortie du vivier : la réinviter lui envoie un nouveau lien`
  return participant.email
}

function toggle(id: string, checked: boolean) {
  selected.value = checked ? [...selected.value, id] : selected.value.filter((value) => value !== id)
}

async function submit() {
  saving.value = true
  serverError.value = ''
  try {
    const result = await useApiAction(`/api/registration-periods/${props.period.id}/invitations`, {
      method: 'POST',
      body: {
        sessionId: sessionId.value === NO_SESSION ? null : sessionId.value,
        participantIds: selected.value,
        newParticipant: hasNewParticipant.value ? { name: newParticipant.name, email: newParticipant.email } : null
      }
    })
    emit('invited', result)
    open.value = false
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Invitation impossible')
  } finally {
    saving.value = false
  }
}
</script>
