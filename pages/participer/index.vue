<template>
  <div class="p-6 space-y-6 max-w-4xl">
    <div>
      <h1 class="text-2xl font-bold">Je participe</h1>
      <p class="text-sm text-gray-500">Les jeux où une équipe vous a inscrit·e : vos sessions, vos inscriptions et vos paiements.</p>
    </div>

    <UAlert v-if="loadError" color="error" variant="soft" :description="loadError" />
    <p v-else-if="pending" class="text-sm text-gray-500">Chargement…</p>
    <UCard v-else-if="!participations.length">
      <p class="text-sm text-gray-600">
        Aucune équipe ne vous a encore inscrit·e avec l’adresse {{ currentUser?.email }}.
        Dès qu’une fiche participant porte cette adresse, le jeu apparaît ici.
      </p>
      <UButton class="mt-3" to="/games" color="neutral" variant="soft" icon="i-heroicons-plus">Organiser un GN</UButton>
    </UCard>

    <!-- Photos (US-109) : retirer les siennes de tous ses jeux, et refuser les suivantes -->
    <UCard v-if="participations.length">
      <template #header>
        <h2 class="text-lg font-semibold">Mes photos</h2>
      </template>
      <p v-if="photoRefused" class="text-sm text-gray-600">
        Vous avez refusé l’usage de votre photo : les équipes ne peuvent pas en ajouter, et vos trombinoscopes n’en montrent pas.
      </p>
      <p v-else class="text-sm text-gray-600">
        Les équipes de vos jeux peuvent ajouter votre photo au trombinoscope de leurs sessions. Vous pouvez retirer vos photos de tous vos jeux, ce qui empêche aussi d’en ajouter.
      </p>
      <div class="mt-3 flex items-center gap-3">
        <UButton
          :color="photoRefused ? 'neutral' : 'error'"
          variant="soft"
          :loading="photoSaving"
          @click="setPhotoRefusal(!photoRefused)"
        >
          {{ photoRefused ? 'Accepter de nouveau une photo' : 'Retirer mes photos' }}
        </UButton>
        <span v-if="photoMessage" class="text-sm text-gray-500">{{ photoMessage }}</span>
      </div>
    </UCard>

    <UCard v-for="entry in participations" :key="entry.game.id">
      <template #header>
        <h2 class="text-lg font-semibold">{{ entry.game.title }}</h2>
        <p v-if="entry.game.photoInformation" class="mt-1 text-xs text-gray-500">{{ entry.game.photoInformation }}</p>
      </template>

      <div class="space-y-6">
        <section v-if="entry.registrations.length" class="space-y-2">
          <h3 class="font-medium">Inscriptions</h3>
          <div v-for="registration in entry.registrations" :key="registration.id" class="flex flex-col gap-2 rounded border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ registration.periodName }}</span>
                <UBadge :color="registrationMeta(registration).color" variant="subtle" size="sm">{{ registrationMeta(registration).label }}</UBadge>
              </div>
              <div v-if="registration.session" class="text-gray-500">
                Session {{ registration.session.name }}<span v-if="registration.session.date"> · {{ formatDate(registration.session.date) }}</span>
              </div>
              <div v-if="(registration.canAccept || registration.canConfirmPlace) && registration.responseDueAt" class="text-gray-500">
                Réponse attendue avant le {{ formatDate(registration.responseDueAt) }}
              </div>
            </div>
            <UButton
              v-if="registration.canAccept || registration.canConfirmPlace || registration.canEdit || registration.canWithdraw"
              :to="`/participer/inscriptions/${registration.id}`"
              size="sm"
              :color="registration.canAccept || registration.canConfirmPlace ? 'primary' : 'neutral'"
              :variant="registration.canAccept || registration.canConfirmPlace ? 'solid' : 'soft'"
            >
              {{ registration.canAccept ? 'Répondre' : registration.canConfirmPlace ? 'Confirmer ma place' : 'Voir ou modifier' }}
            </UButton>
          </div>
        </section>

        <section class="space-y-2">
          <h3 class="font-medium">Sessions</h3>
          <p v-if="!entry.sessions.length" class="text-sm text-gray-500">Aucune session pour l’instant.</p>
          <div v-for="session in entry.sessions" :key="session.id" class="rounded border border-gray-200 p-3 text-sm space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ session.name }}</span>
              <UBadge :color="sessionMeta(session).color" variant="subtle" size="sm">{{ sessionMeta(session).label }}</UBadge>
              <UBadge v-for="role in session.roles" :key="role" color="neutral" variant="outline" size="sm">{{ roleLabel(role) }}</UBadge>
            </div>
            <div class="text-gray-500">
              {{ session.date ? formatDate(session.date) : 'Date à venir' }}
              <span v-if="session.location"> · {{ session.location.name }}<span v-if="session.location.address">, {{ session.location.address }}</span></span>
            </div>
            <div v-if="session.attendance" class="text-gray-600">
              Présence : {{ attendanceLabel(session.attendance.status) }}
            </div>

            <div v-if="session.payment" class="rounded bg-gray-50 p-2 space-y-1">
              <div v-if="session.payment.offered">Place offerte : rien à payer.</div>
              <template v-else>
                <div v-if="session.payment.mode === 'simple'">
                  {{ session.payment.paidAt ? `Payé le ${formatDate(session.payment.paidAt)}.` : 'Paiement attendu.' }}
                </div>
                <div v-else>
                  Dû : <strong>{{ formatEuros(session.payment.dueCents) }}</strong>
                  <span v-if="session.payment.tariffName" class="text-gray-500"> ({{ session.payment.tariffName }})</span>
                  · versé : {{ formatEuros(session.payment.receivedCents) }}
                  · reste : <strong>{{ formatEuros(session.payment.remainingCents) }}</strong>
                </div>
                <div v-if="session.payment.refundStatus" class="text-gray-600">{{ refundLabel(session.payment.refundStatus) }}</div>
                <div v-if="owes(session.payment)" class="flex flex-wrap gap-2 pt-1">
                  <UButton
                    v-if="session.payment.paymentLinkUrl"
                    :to="session.payment.paymentLinkUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    size="xs"
                    color="primary"
                    icon="i-heroicons-credit-card"
                  >
                    Payer en ligne
                  </UButton>
                  <UButton
                    v-if="session.payment.hasRib"
                    :to="`/api/me/sessions/${session.id}/rib`"
                    target="_blank"
                    external
                    size="xs"
                    color="neutral"
                    variant="soft"
                    icon="i-heroicons-document-arrow-down"
                  >
                    RIB
                  </UButton>
                </div>
              </template>
            </div>

            <div v-if="session.documents?.length" class="space-y-1">
              <div class="font-medium text-gray-700">Documents reçus</div>
              <div v-for="document in session.documents" :key="document.id" class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <NuxtLink v-if="document.available" :to="`/participer/documents/${document.id}`" class="text-primary-600 hover:underline">{{ document.title }}</NuxtLink>
                  <span v-else>{{ document.title }}</span>
                  <span class="text-gray-500"> · reçu le {{ formatDate(document.sentAt) }}</span>
                </div>
                <span v-if="!document.available" class="text-xs text-gray-500">Plus disponible ici : voir l’email</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { REFUND_STATUSES, REGISTRATION_STATUS_META, SESSION_ROLE_LABELS, SESSION_ROLES, metaOf } from '~/utils/domain'
import { ATTENDANCE_STATUSES } from '~/utils/attendance'
import { serverMessage } from '~/utils/apiErrors'
import { rememberSpace } from '~/utils/spaces'
import { sessionStatusMeta } from '~/utils/sessions'
import { formatEuros } from '~/utils/sessionTariffs'
import { formatLongDate as formatDate } from '~/utils/dates'
import type { ApiResponse } from '~/composables/useApiFetch'

type Participation = ApiResponse<'/api/me/participations'>[number]
type Payment = NonNullable<Participation['sessions'][number]['payment']>

// Espace « Je participe » (US-071)
const { data: authState } = await useFetch('/api/auth/me')
const currentUser = computed(() => authState.value?.authenticated ? authState.value.user : null)
const participations = ref<Participation[]>([])
const pending = ref(true)
const loadError = ref('')
const photoRefused = ref(false)
const photoSaving = ref(false)
const photoMessage = ref('')

onMounted(async () => {
  rememberSpace('participate', currentUser.value?.id)
  try {
    // Gardée sur l'appareil : sur le lieu du jeu, sans réseau, on retrouve date et lieu
    participations.value = await useApiFetch('/api/me/participations', { offlineCache: true })
    // Lu à chaque ouverture, sans copie sur l'appareil : le refus peut changer ailleurs (autre appareil, équipe)
    photoRefused.value = (await useApiFetch('/api/me/photo-refusal').catch(() => ({ refused: false }))).refused
  } catch (err) {
    loadError.value = serverMessage(err, 'Impossible de charger vos participations.')
  } finally {
    pending.value = false
  }
})

async function setPhotoRefusal(refused: boolean) {
  if (refused && !confirm('Retirer vos photos de tous vos jeux ? Les trombinoscopes déjà générés seront refaits sans elles.')) return
  photoSaving.value = true
  photoMessage.value = ''
  try {
    await useApiAction('/api/me/photo-refusal', { method: 'POST', body: { refused } })
    photoRefused.value = refused
    photoMessage.value = refused ? 'Vos photos sont retirées.' : 'Les équipes peuvent de nouveau ajouter votre photo.'
  } catch (err) {
    photoMessage.value = serverMessage(err, 'L’enregistrement a échoué.')
  } finally {
    photoSaving.value = false
  }
}

const sessionMeta = (session: { status: string }) => sessionStatusMeta(session.status)
const registrationMeta = (registration: { status: string }) => metaOf(REGISTRATION_STATUS_META, registration.status) || { label: registration.status, color: 'neutral' as const }
// Casting et inscription confirmée : « PJ » plutôt que « Participant »
const roleLabel = (role: string) => role === SESSION_ROLES.participant ? 'PJ' : metaOf(SESSION_ROLE_LABELS, role) || role

const ATTENDANCE_LABELS: Record<string, string> = {
  [ATTENDANCE_STATUSES.pending]: 'réponse attendue',
  [ATTENDANCE_STATUSES.confirmed]: 'confirmée',
  [ATTENDANCE_STATUSES.declined]: 'déclinée',
  [ATTENDANCE_STATUSES.released]: 'place libérée'
}
const attendanceLabel = (status: string) => ATTENDANCE_LABELS[status] || status

const REFUND_LABELS: Record<string, string> = {
  [REFUND_STATUSES.toRefund]: 'Remboursement prévu par l’équipe.',
  [REFUND_STATUSES.refunded]: 'Remboursé.',
  [REFUND_STATUSES.carriedOver]: 'Paiement reporté sur la nouvelle session.',
  [REFUND_STATUSES.kept]: 'Paiement gardé par l’équipe.',
  [REFUND_STATUSES.transferred]: 'Paiement transféré à la personne qui vous remplace.'
}
const refundLabel = (status: string) => REFUND_LABELS[status] || ''

// Reste à payer : montant restant en mode tarifs, case non cochée en mode simple
const owes = (payment: Payment) => payment.mode === 'simple' ? !payment.paidAt : (payment.remainingCents || 0) > 0
</script>
