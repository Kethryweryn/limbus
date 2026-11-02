<template>
  <UModal v-model:open="open" :title="`Inviter · ${link.session.name}`">
    <template #body>
      <form class="space-y-5" @submit.prevent="submit">
        <p class="text-sm text-gray-500">
          {{ invitedCount }} invitation{{ invitedCount > 1 ? 's' : '' }} pour {{ seats }} place{{ seats > 1 ? 's' : '' }}.
          Chaque personne reçoit par email un lien personnel pour répondre.
        </p>

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
          v-if="overSeats"
          color="warning"
          variant="soft"
          :description="`Avec ces invitations, la session dépasse ses ${seats} places.`"
        />
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
import { invitedCount as countInvited, registeredParticipantIds, withdrawnParticipantIds } from '~/utils/registrations'
import { fetchByUrl, type ApiResponse } from '~/composables/useApiFetch'
import type { InvitationResult, PeriodSessionLink, RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

type Participant = ApiResponse<'/api/participants'>[number]

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  gameId: string
  period: RegistrationPeriod
  // Session à laquelle on invite
  link: PeriodSessionLink
}>()

const emit = defineEmits<{ invited: [result: InvitationResult] }>()

const participants = ref<Participant[]>([])
const selected = ref<string[]>([])
const search = ref('')
const newParticipant = reactive({ name: '', email: '' })
const serverError = ref('')
const saving = ref(false)

const seats = computed(() => props.link.seats)
const invitedCount = computed(() => countInvited(props.period.registrations, props.link.sessionId))
// Une seule inscription en cours par personne dans la période ; qui a décliné ou s'est désisté repart avec un nouveau lien
const registeredIds = computed(() => registeredParticipantIds(props.period.registrations))
const withdrawnIds = computed(() => withdrawnParticipantIds(props.period.registrations))

watch(open, async (value) => {
  if (!value) return
  selected.value = []
  search.value = ''
  newParticipant.name = ''
  newParticipant.email = ''
  serverError.value = ''
  try {
    participants.value = await fetchByUrl<Participant[]>(`/api/participants?gameId=${encodeURIComponent(props.gameId)}`)
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
const overSeats = computed(() => invitedCount.value + toInviteCount.value > seats.value)

function canInvite(participant: Participant) {
  return Boolean(participant.email?.trim()) && !registeredIds.value.includes(participant.id)
}

function participantDescription(participant: Participant) {
  if (registeredIds.value.includes(participant.id)) return 'Déjà inscrit dans cette période'
  if (!participant.email?.trim()) return 'Sans email : ajoutez-en un sur sa fiche pour l’inviter'
  if (withdrawnIds.value.includes(participant.id)) return `${participant.email} · a décliné ou s’est désisté·e : la réinviter lui envoie un nouveau lien`
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
        sessionId: props.link.sessionId,
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
