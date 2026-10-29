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
        Aucune équipe ne vous a encore inscrit·e avec l’adresse {{ authState?.user?.email }}.
        Dès qu’une fiche participant porte cette adresse, le jeu apparaît ici.
      </p>
      <UButton class="mt-3" to="/games" color="neutral" variant="soft" icon="i-heroicons-plus">Organiser un GN</UButton>
    </UCard>

    <UCard v-for="entry in participations" :key="entry.game.id">
      <template #header>
        <h2 class="text-lg font-semibold">{{ entry.game.title }}</h2>
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
              <div v-if="registration.canAccept && registration.responseDueAt" class="text-gray-500">
                Réponse attendue avant le {{ formatDate(registration.responseDueAt) }}
              </div>
            </div>
            <UButton
              v-if="registration.canAccept || registration.canEdit || registration.canWithdraw"
              :to="`/participer/inscriptions/${registration.id}`"
              size="sm"
              :color="registration.canAccept ? 'primary' : 'neutral'"
              :variant="registration.canAccept ? 'solid' : 'soft'"
            >
              {{ registration.canAccept ? 'Répondre' : 'Voir ou modifier' }}
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
          </div>
        </section>
      </div>
    </UCard>
  </div>
</template>

<script setup>
import { REFUND_STATUSES, REGISTRATION_STATUS_META, SESSION_ROLE_LABELS, SESSION_ROLES, SESSION_STATUS_META } from '~/utils/domain'
import { rememberSpace } from '~/utils/spaces'

// Espace « Je participe » (US-071)
const { data: authState } = await useFetch('/api/auth/me')
const participations = ref([])
const pending = ref(true)
const loadError = ref('')

onMounted(async () => {
  rememberSpace('participate')
  try {
    // Gardée sur l'appareil : sur le lieu du jeu, sans réseau, on retrouve date et lieu
    participations.value = await useApiFetch('/api/me/participations', { offlineCache: true })
  } catch (err) {
    loadError.value = err?.data?.message || 'Impossible de charger vos participations.'
  } finally {
    pending.value = false
  }
})

const sessionMeta = (session) => SESSION_STATUS_META[session.status] || { label: session.status, color: 'neutral' }
const registrationMeta = (registration) => REGISTRATION_STATUS_META[registration.status] || { label: registration.status, color: 'neutral' }
// Casting et inscription confirmée : « PJ » plutôt que « Participant »
const roleLabel = (role) => role === SESSION_ROLES.participant ? 'PJ' : SESSION_ROLE_LABELS[role] || role

const ATTENDANCE_LABELS = { pending: 'réponse attendue', confirmed: 'confirmée', declined: 'déclinée', released: 'place libérée' }
const attendanceLabel = (status) => ATTENDANCE_LABELS[status] || status

const REFUND_LABELS = {
  [REFUND_STATUSES.toRefund]: 'Remboursement prévu par l’équipe.',
  [REFUND_STATUSES.refunded]: 'Remboursé.',
  [REFUND_STATUSES.carriedOver]: 'Paiement reporté sur la nouvelle session.',
  [REFUND_STATUSES.kept]: 'Paiement gardé par l’équipe.',
  [REFUND_STATUSES.transferred]: 'Paiement transféré à la personne qui vous remplace.'
}
const refundLabel = (status) => REFUND_LABELS[status] || ''

// Reste à payer : montant restant en mode tarifs, case non cochée en mode simple
const owes = (payment) => payment.mode === 'simple' ? !payment.paidAt : payment.remainingCents > 0

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long' })
const formatEuros = (cents) => ((cents || 0) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
</script>
