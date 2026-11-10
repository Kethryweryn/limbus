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

    <UCard v-for="entry in participations" :key="entry.game.id">
      <template #header>
        <h2 class="text-lg font-semibold">{{ entry.game.title }}</h2>
        <p v-if="entry.game.photoInformation" class="mt-1 text-xs text-gray-500">{{ entry.game.photoInformation }}</p>
      </template>

      <div class="space-y-6">
        <section v-if="entry.registrations.length" class="space-y-2">
          <h3 class="font-medium">Inscription</h3>
          <div v-for="registration in entry.registrations" :key="registration.id" class="flex flex-col gap-2 rounded border border-gray-200 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="text-sm space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge :color="registrationMeta(registration).color" variant="subtle" size="sm">{{ registrationMeta(registration).label }}</UBadge>
              </div>
              <div v-if="registration.canAccept && registration.responseDueAt" class="text-gray-500">
                Réponse attendue avant le {{ formatDate(registration.responseDueAt) }}
              </div>
              <div v-for="line in registration.sessions" :key="line.sessionId" class="flex flex-wrap items-center gap-2 text-gray-600">
                <span>{{ line.session.name }}<span v-if="line.session.date"> · {{ formatDate(line.session.date) }}</span></span>
                <UBadge :color="lineMeta(line).color" variant="subtle" size="sm">{{ lineMeta(line).label }}</UBadge>
                <span v-if="line.canConfirmPlace && line.responseDueAt" class="text-gray-500">à confirmer avant le {{ formatDate(line.responseDueAt) }}</span>
              </div>
            </div>
            <UButton
              v-if="registration.canAccept || registration.canEdit"
              :to="`/participer/inscriptions/${registration.id}`"
              size="sm"
              :color="registration.canAccept || confirmable(registration) ? 'primary' : 'neutral'"
              :variant="registration.canAccept || confirmable(registration) ? 'solid' : 'soft'"
            >
              {{ registration.canAccept ? 'Répondre' : confirmable(registration) ? 'Confirmer ma place' : 'Voir ou modifier' }}
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
import { REFUND_STATUSES, REGISTRATION_SESSION_STATUS_META, REGISTRATION_STATUS_META, SESSION_ROLE_LABELS, SESSION_ROLES, metaOf } from '~/utils/domain'
import { ATTENDANCE_STATUSES } from '~/utils/attendance'
import { loadErrorMessage } from '~/utils/apiErrors'
import { rememberSpace } from '~/utils/spaces'
import { sessionStatusMeta } from '~/utils/sessions'
import { formatEuros } from '~/utils/sessionTariffs'
import { formatLongDate as formatDate } from '~/utils/dates'
import type { ApiResponse } from '~/composables/useApiFetch'
import { MY_PARTICIPATIONS_READ } from '~/utils/offlinePlan'

type Participation = ApiResponse<'/api/me/participations'>[number]
type Payment = NonNullable<Participation['sessions'][number]['payment']>
type MyRegistration = Participation['registrations'][number]

// Espace « Je participe » (US-071)
const { data: authState } = await useFetch('/api/auth/me')
const currentUser = computed(() => authState.value?.authenticated ? authState.value.user : null)
const participations = ref<Participation[]>([])
const pending = ref(true)
const loadError = ref('')

onMounted(async () => {
  rememberSpace('participate', currentUser.value?.id)
  try {
    // Gardée sur l'appareil : sur le lieu du jeu, sans réseau, on retrouve date et lieu
    participations.value = await useApiFetch(MY_PARTICIPATIONS_READ, { offlineCache: true })
  } catch (err) {
    loadError.value = loadErrorMessage(err, 'Impossible de charger vos participations.')
  } finally {
    pending.value = false
  }
})

const sessionMeta = (session: { status: string }) => sessionStatusMeta(session.status)
const registrationMeta = (registration: { status: string }) => metaOf(REGISTRATION_STATUS_META, registration.status) || { label: registration.status, color: 'neutral' as const }
const lineMeta = (line: { status: string, validated: boolean }) => metaOf(REGISTRATION_SESSION_STATUS_META, line.validated ? 'validated' : line.status) || { label: line.status, color: 'neutral' as const }
const confirmable = (registration: MyRegistration) => registration.sessions.some((line) => line.canConfirmPlace)
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
