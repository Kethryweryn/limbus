<template>
  <UModal v-model:open="open" :title="`Inviter · ${sessionName}`">
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

<script setup>
const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  gameId: { type: String, required: true },
  periodId: { type: String, required: true },
  sessionId: { type: String, required: true },
  sessionName: { type: String, required: true },
  seats: { type: Number, required: true },
  invitedCount: { type: Number, required: true },
  // Participants qui ont déjà une inscription dans la période : une seule par personne
  registeredParticipantIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['invited'])

const participants = ref([])
const selected = ref([])
const search = ref('')
const newParticipant = reactive({ name: '', email: '' })
const serverError = ref('')
const saving = ref(false)

watch(open, async (value) => {
  if (!value) return
  selected.value = []
  search.value = ''
  newParticipant.name = ''
  newParticipant.email = ''
  serverError.value = ''
  try {
    const all = await useApiFetch('/api/participants')
    participants.value = all.filter((participant) => participant.games.some((game) => game.id === props.gameId))
  } catch (err) {
    serverError.value = err?.data?.message || err?.message || 'Impossible de charger les participants'
  }
}, { immediate: true }) // La modale est montée déjà ouverte au premier clic sur « Inviter »

const visibleParticipants = computed(() => {
  const query = search.value.trim().toLowerCase()
  return participants.value.filter((participant) => !query || participant.name.toLowerCase().includes(query))
})

const hasNewParticipant = computed(() => Boolean(newParticipant.name.trim() || newParticipant.email.trim()))
const toInviteCount = computed(() => selected.value.length + (hasNewParticipant.value ? 1 : 0))
const overSeats = computed(() => props.invitedCount + toInviteCount.value > props.seats)

function canInvite(participant) {
  return Boolean(participant.email?.trim()) && !props.registeredParticipantIds.includes(participant.id)
}

function participantDescription(participant) {
  if (props.registeredParticipantIds.includes(participant.id)) return 'Déjà inscrit dans cette période'
  if (!participant.email?.trim()) return 'Sans email : ajoutez-en un sur sa fiche pour l’inviter'
  return participant.email
}

function toggle(id, checked) {
  selected.value = checked ? [...selected.value, id] : selected.value.filter((value) => value !== id)
}

async function submit() {
  saving.value = true
  serverError.value = ''
  try {
    const result = await useApiFetch(`/api/registration-periods/${props.periodId}/invitations`, {
      method: 'POST',
      body: {
        sessionId: props.sessionId,
        participantIds: selected.value,
        newParticipant: hasNewParticipant.value ? { name: newParticipant.name, email: newParticipant.email } : null
      }
    })
    emit('invited', result)
    open.value = false
  } catch (err) {
    const details = err?.data?.data?.map?.((issue) => issue.message).join(', ')
    serverError.value = err?.data?.message === 'Invalid request body' && details
      ? `Saisie invalide : ${details}`
      : err?.data?.message || err?.message || 'Invitation impossible'
  } finally {
    saving.value = false
  }
}
</script>
