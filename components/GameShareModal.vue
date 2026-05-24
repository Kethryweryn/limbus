<template>
  <UModal v-model:open="open" :title="`Partage - ${game?.title || 'Jeu'}`">
    <template #body>
      <div class="space-y-4">
        <form class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2" @submit.prevent="inviteUser">
          <UInput
            v-model="inviteEmail"
            type="email"
            placeholder="email@exemple.fr"
            required
          />
          <UButton type="submit" color="primary" :disabled="!inviteEmail" :loading="inviting">
            Inviter
          </UButton>
        </form>

        <UAlert
          v-if="shareMessage"
          color="success"
          variant="soft"
          :description="shareMessage"
        />
        <UAlert
          v-if="shareError"
          color="error"
          variant="soft"
          :description="shareError"
        />

        <div class="space-y-2">
          <h3 class="font-semibold">Accès actifs</h3>
          <div
            v-for="share in shares"
            :key="share.id"
            class="flex items-center justify-between gap-3 rounded border border-gray-200 p-3"
          >
            <div>
              <div class="font-medium">{{ share.user?.name }}</div>
              <div class="text-sm text-gray-500">{{ share.user?.email }}</div>
            </div>
            <UButton color="error" variant="soft" size="xs" @click="removeShare(share.userId)">
              Retirer
            </UButton>
          </div>
          <p v-if="!shares.length" class="text-sm text-gray-500">Aucun partage pour ce jeu.</p>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold">Invitations</h3>
          <div
            v-for="invitation in invitations"
            :key="invitation.id"
            class="flex items-center justify-between gap-3 rounded border border-gray-200 p-3"
          >
            <div>
              <div class="font-medium">{{ invitation.email }}</div>
              <div class="text-sm text-gray-500">
                {{ invitationStatusLabel(invitation) }}
                <span v-if="invitation.acceptedBy"> · {{ invitation.acceptedBy.name }}</span>
              </div>
              <div v-if="invitation.invitationUrl" class="mt-1 text-xs text-gray-500 break-all">
                {{ invitation.invitationUrl }}
              </div>
            </div>
            <UButton
              v-if="invitation.status === GAME_INVITATION_STATUSES.pending"
              color="error"
              variant="soft"
              size="xs"
              @click="revokeInvitation(invitation.id)"
            >
              Annuler
            </UButton>
          </div>
          <p v-if="!invitations.length" class="text-sm text-gray-500">Aucune invitation.</p>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { GAME_INVITATION_STATUSES } from '~/utils/domain'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  game: {
    type: Object,
    default: null
  }
})

const shares = ref([])
const invitations = ref([])
const inviteEmail = ref('')
const inviting = ref(false)
const shareMessage = ref('')
const shareError = ref('')

watch(open, async (value) => {
  if (!value) return
  resetMessages()
  await refreshShares()
})

watch(() => props.game?.id, async () => {
  if (!open.value) return
  resetState()
  await refreshShares()
})

function resetMessages() {
  shareMessage.value = ''
  shareError.value = ''
}

function resetState() {
  shares.value = []
  invitations.value = []
  inviteEmail.value = ''
  resetMessages()
}

async function refreshShares() {
  if (!props.game?.id) return

  try {
    const data = await useApiFetch(`/api/games/${props.game.id}/shares`)
    shares.value = data.shares || []
    invitations.value = data.invitations || []
    shareError.value = ''
  } catch (err) {
    shareError.value = err?.data?.message || err?.message || 'Impossible de charger les partages'
  }
}

async function inviteUser() {
  if (!props.game?.id || !inviteEmail.value) return

  inviting.value = true
  resetMessages()
  try {
    const invitation = await useApiFetch(`/api/games/${props.game.id}/invitations`, {
      method: 'POST',
      body: { email: inviteEmail.value }
    })
    inviteEmail.value = ''
    await refreshShares()
    if (invitation.emailDelivery?.sent) {
      shareMessage.value = `Invitation envoyée à ${invitation.email}.`
    } else {
      shareError.value = `Invitation créée, mais email non envoyé : ${invitation.emailDelivery?.reason || 'raison inconnue'}.`
    }
  } catch (err) {
    shareError.value = err?.data?.message || err?.message || 'Impossible de créer l’invitation'
  } finally {
    inviting.value = false
  }
}

async function removeShare(userId) {
  if (!props.game?.id || !userId) return

  try {
    resetMessages()
    await useApiFetch(`/api/games/${props.game.id}/shares/${userId}`, { method: 'DELETE' })
    await refreshShares()
  } catch (err) {
    shareError.value = err?.data?.message || err?.message || 'Impossible de retirer le partage'
  }
}

async function revokeInvitation(invitationId) {
  if (!props.game?.id || !invitationId) return

  try {
    resetMessages()
    await useApiFetch(`/api/games/${props.game.id}/invitations/${invitationId}`, { method: 'DELETE' })
    await refreshShares()
  } catch (err) {
    shareError.value = err?.data?.message || err?.message || 'Impossible d’annuler l’invitation'
  }
}

function invitationStatusLabel(invitation) {
  if (invitation.status === GAME_INVITATION_STATUSES.accepted) return 'Acceptée'
  if (invitation.status === GAME_INVITATION_STATUSES.revoked) return 'Annulée'
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return 'Expirée'
  return 'En attente'
}
</script>
