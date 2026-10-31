<template>
  <UModal v-model:open="open" :title="registration ? registration.participant.name : 'Inscription'">
    <template #body>
      <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" />
      <p v-else-if="!registration" class="text-sm text-gray-500">Chargement…</p>
      <div v-else class="space-y-4 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="statusMeta.color" variant="subtle">{{ statusMeta.label }}</UBadge>
          <span v-if="registration.session" class="text-gray-600">{{ registration.session.name }}</span>
        </div>
        <UAlert
          v-if="registration.missingFromSession"
          color="warning"
          variant="soft"
          description="Cette personne a confirmé, mais n’est plus participante de la session : elle en a été retirée depuis l’écran de session."
        />

        <section v-if="registration.respondedAt" class="space-y-1">
          <h3 class="font-semibold text-gray-700">Contact</h3>
          <p>{{ [registration.firstName, registration.lastName].filter(Boolean).join(' ') || '—' }}</p>
          <p>{{ registration.email }}</p>
          <p v-if="registration.phone">{{ registration.phone }}</p>
          <p v-if="registration.facebookName" class="text-gray-600">Facebook : {{ registration.facebookName }}</p>
        </section>

        <section v-if="registration.respondedAt" class="space-y-1">
          <h3 class="font-semibold text-gray-700">Contact d’urgence</h3>
          <p>{{ [registration.emergencyContactName, registration.emergencyContactPhone].filter(Boolean).join(' · ') || '—' }}</p>
        </section>

        <section v-if="registration.respondedAt" class="space-y-1">
          <h3 class="font-semibold text-gray-700">Allergies et intolérances</h3>
          <p class="whitespace-pre-line">{{ registration.dietary || 'Aucune déclarée' }}</p>
          <p v-if="registration.healthConsentAt" class="text-xs text-gray-500">
            Consentement donné le {{ formatDateTime(registration.healthConsentAt) }}
          </p>
        </section>

        <section v-if="registration.respondedAt && hasAffinities" class="space-y-2">
          <h3 class="font-semibold text-gray-700">Affinités</h3>
          <div v-for="affinity in REGISTRATION_AFFINITIES" v-show="registration.affinities[affinity.key]?.length" :key="affinity.key">
            <p class="text-gray-600">{{ affinity.label }}</p>
            <ul class="list-disc pl-5">
              <li v-for="(line, index) in registration.affinities[affinity.key]" :key="index">{{ line }}</li>
            </ul>
          </div>
        </section>

        <section v-if="registration.respondedAt && registration.questions.length" class="space-y-2">
          <h3 class="font-semibold text-gray-700">Questions</h3>
          <div v-for="question in registration.questions" :key="question.id">
            <p class="text-gray-600">{{ question.label }}</p>
            <p class="whitespace-pre-line">{{ answerText(question) }}</p>
          </div>
        </section>

        <p v-if="!registration.respondedAt" class="text-gray-600">
          Pas encore de réponse au formulaire.
        </p>

        <section class="space-y-1 text-xs text-gray-500">
          <p v-if="registration.invitedBy">Invitée par {{ registration.invitedBy.name }}</p>
          <p v-if="registration.invitationSentAt">Invitation envoyée le {{ formatDateTime(registration.invitationSentAt) }}</p>
          <p v-if="registration.lastRemindedAt">Relancée le {{ formatDateTime(registration.lastRemindedAt) }}</p>
          <p v-if="registration.responseDueAt && registration.status === REGISTRATION_STATUSES.invited">Réponse attendue avant le {{ formatDateTime(registration.responseDueAt) }}</p>
          <p v-if="registration.respondedAt">Réponse le {{ formatDateTime(registration.respondedAt) }}</p>
          <p v-if="registration.charterAcceptedAt">Charte acceptée le {{ formatDateTime(registration.charterAcceptedAt) }}</p>
          <p v-if="registration.formVersion">Formulaire, version {{ registration.formVersion.number }}</p>
        </section>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { REGISTRATION_STATUSES } from '~/utils/domain'
import { REGISTRATION_AFFINITIES } from '~/utils/registrationForms'
import { REGISTRATION_DISPLAY_STATUS_META, registrationDisplayStatus } from '~/utils/registrations'
import { apiErrorMessage } from '~/utils/apiErrors'

// Détail d'une inscription (US-005) : réponses au formulaire, dont les allergies (données de santé, R14)
const props = defineProps({
  registrationId: { type: String, default: null }
})
const open = defineModel('open', { type: Boolean, default: false })

const registration = ref(null)
const errorMessage = ref('')

const statusMeta = computed(() => REGISTRATION_DISPLAY_STATUS_META[registrationDisplayStatus(registration.value)]
  || { label: registration.value?.status, color: 'neutral' })

watch([open, () => props.registrationId], async ([isOpen, id]) => {
  if (!isOpen || !id) return
  registration.value = null
  errorMessage.value = ''
  try {
    registration.value = await useApiFetch(`/api/registrations/${id}`)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible de charger l’inscription')
  }
}, { immediate: true })

const hasAffinities = computed(() => Object.values(registration.value?.affinities || {}).some((lines) => lines.length))

// Réponse à une question propre au jeu (US-081), lue avec la version du formulaire remplie
function answerText(question) {
  const answer = registration.value?.questionAnswers?.[question.id]
  if (answer === null || answer === undefined || answer === '' || (Array.isArray(answer) && !answer.length)) return '—'
  if (Array.isArray(answer)) return answer.join(', ')
  return question.type === 'scale' ? `${answer} / 5` : String(answer)
}

const formatDateTime = (value) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
</script>
