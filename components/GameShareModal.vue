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
            <div class="flex flex-wrap justify-end gap-2">
              <!-- Transfert du jeu (US-060) : seule la propriétaire le propose -->
              <template v-if="isOwner">
                <UButton
                  v-if="game?.transferToUserId === share.userId"
                  color="neutral"
                  variant="soft"
                  size="xs"
                  @click="cancelTransfer"
                >
                  Retirer la proposition de transfert
                </UButton>
                <UButton
                  v-else
                  color="neutral"
                  variant="soft"
                  size="xs"
                  @click="proposeTransfer(share)"
                >
                  Proposer le transfert
                </UButton>
              </template>
              <UButton color="error" variant="soft" size="xs" @click="removeShare(share.userId)">
                Retirer
              </UButton>
            </div>
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

<script setup lang="ts">
import { GAME_INVITATION_STATUSES } from '~/utils/domain'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

type SharesResponse = ApiResponse<'/api/games/:id/shares'>
type Share = SharesResponse['shares'][number]
type Invitation = SharesResponse['invitations'][number]

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(defineProps<{
  game?: { id: string, title: string, transferToUserId?: string | null } | null
  isOwner?: boolean
}>(), { game: null, isOwner: false })
const emit = defineEmits<{ changed: [] }>()

async function proposeTransfer(share: Share) {
  if (!props.game) return
  if (!confirm(`Proposer à ${share.user?.name} de devenir propriétaire de « ${props.game.title} » ? Vous en resterez co-organisatrice.`)) return
  try {
    await useApiFetch(`/api/games/${props.game.id}/transfer`, { method: 'POST', body: { userId: share.userId } })
    shareMessage.value = `Transfert proposé à ${share.user?.name} : il prendra effet quand elle l’acceptera.`
    shareError.value = ''
    emit('changed')
  } catch (err) {
    shareError.value = apiErrorMessage(err, 'Erreur inconnue')
  }
}

async function cancelTransfer() {
  if (!props.game) return
  try {
    await useApiFetch(`/api/games/${props.game.id}/transfer`, { method: 'DELETE' })
    shareMessage.value = 'Proposition de transfert retirée.'
    shareError.value = ''
    emit('changed')
  } catch (err) {
    shareError.value = apiErrorMessage(err, 'Erreur inconnue')
  }
}

const shares = ref<Share[]>([])
const invitations = ref<Invitation[]>([])
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
    shareError.value = apiErrorMessage(err, 'Impossible de charger les partages')
  }
}

async function inviteUser() {
  if (!props.game?.id || !inviteEmail.value) return

  inviting.value = true
  resetMessages()
  try {
    const response = await useApiFetch(`/api/games/${props.game.id}/invitations`, {
      method: 'POST',
      body: { email: inviteEmail.value }
    })
    const invitation = actionResult(response)
    inviteEmail.value = ''
    await refreshShares()
    if (invitation.emailDelivery?.sent) {
      shareMessage.value = `Invitation envoyée à ${invitation.email}.`
    } else {
      shareError.value = `Invitation créée, mais email non envoyé : ${invitation.emailDelivery?.reason || 'raison inconnue'}.`
    }
  } catch (err) {
    shareError.value = apiErrorMessage(err, 'Impossible de créer l’invitation')
  } finally {
    inviting.value = false
  }
}

async function removeShare(userId: string) {
  if (!props.game?.id || !userId) return

  try {
    resetMessages()
    await useApiFetch(`/api/games/${props.game.id}/shares/${userId}`, { method: 'DELETE' })
    await refreshShares()
    // Un transfert proposé à cette personne tombe avec son partage
    emit('changed')
  } catch (err) {
    shareError.value = apiErrorMessage(err, 'Impossible de retirer le partage')
  }
}

async function revokeInvitation(invitationId: string) {
  if (!props.game?.id || !invitationId) return

  try {
    resetMessages()
    await useApiFetch(`/api/games/${props.game.id}/invitations/${invitationId}`, { method: 'DELETE' })
    await refreshShares()
  } catch (err) {
    shareError.value = apiErrorMessage(err, 'Impossible d’annuler l’invitation')
  }
}

function invitationStatusLabel(invitation: Invitation) {
  if (invitation.status === GAME_INVITATION_STATUSES.accepted) return 'Acceptée'
  if (invitation.status === GAME_INVITATION_STATUSES.revoked) return 'Annulée'
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return 'Expirée'
  return 'En attente'
}
</script>
