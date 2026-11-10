<template>
  <div class="space-y-6">
      <p v-if="loading" class="text-sm text-gray-500">Chargement…</p>

      <!-- Réseau absent ou serveur en panne (US-218) : l'inscription existe peut-être, elle ne se lit pas -->
      <UCard v-else-if="loadError">
        <h1 class="text-xl font-semibold">Inscription indisponible</h1>
        <UAlert class="mt-3" color="error" variant="soft" :description="loadError" />
      </UCard>

      <UCard v-else-if="invalid">
        <h1 class="text-xl font-semibold">{{ personalLink ? 'Lien invalide' : 'Inscription introuvable' }}</h1>
        <p class="mt-2 text-sm text-gray-600">
          {{ personalLink ? 'Ce lien n’est pas valide.' : 'Cette inscription est introuvable.' }} Si vous pensez qu’il s’agit d’une erreur, contactez l’équipe d’organisation du jeu.
        </p>
      </UCard>

      <UCard v-else-if="withdrawn">
        <h1 class="text-xl font-semibold">{{ withdrawn.game.title }}</h1>
        <p class="mt-2 text-sm text-gray-600">
          {{ withdrawalMessage }}
          {{ personalLink ? 'Ce lien ne permet plus rien.' : 'Cette inscription ne permet plus rien.' }} Pour toute question, contactez l’équipe d’organisation du jeu.
        </p>
      </UCard>

      <template v-else-if="details">
        <UCard>
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold">{{ details.game.title }}</h1>
              <UBadge :color="statusMeta.color" variant="subtle">{{ statusMeta.label }}</UBadge>
            </div>
            <p v-if="details.invitedSession" class="text-sm text-gray-600">
              Invitation pour la session {{ details.invitedSession.name }}<span v-if="details.invitedSession.date"> · {{ formatLongDate(details.invitedSession.date) }}</span>.
              Cochez-la si vous êtes disponible : vous y serez inscrit·e s’il reste une place.
            </p>
            <p v-if="details.canAccept && details.responseDueAt" class="text-sm text-gray-600">
              Réponse attendue avant le {{ formatLongDate(details.responseDueAt) }}.
            </p>
          </div>
        </UCard>

        <UAlert
          v-if="successMessage"
          color="success"
          variant="soft"
          :title="successMessage"
          :description="successDetail"
        />
        <UAlert
          v-if="details.overdue"
          color="warning"
          variant="soft"
          description="Le délai de réponse est dépassé. Vous pouvez encore répondre tant que l’équipe d’organisation n’a pas retiré votre invitation."
        />

        <!-- Une date décochée alors que la place est annoncée ne change rien : il faut annuler (R29) -->
        <UAlert
          v-if="keptSessions.length"
          color="warning"
          variant="soft"
          :description="`Votre présence à ${keptSessions.join(', ')} reste enregistrée. Si vous ne pouvez plus venir, annulez-la ci-dessous.`"
        />

        <!-- Lien d'une demande de disponibilités (R11) : ouvrir ne répond pas, la personne confirme ici -->
        <UCard v-if="availabilityPrompt" data-availability-prompt>
          <h2 class="font-semibold">
            Session {{ availabilityPrompt.name }}<span v-if="availabilityPrompt.date"> · {{ formatLongDate(availabilityPrompt.date) }}</span>
          </h2>
          <p class="mt-2 text-sm text-gray-600">
            Êtes-vous disponible ? Répondre « Disponible » vous pré-inscrit : cela ne garantit pas de place et ne confirme pas votre inscription.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton :variant="availabilityRequest?.available ? 'solid' : 'soft'" color="primary" :loading="answering" @click="answerAvailability(true)">
              Confirmer : disponible
            </UButton>
            <UButton :variant="availabilityRequest?.available ? 'soft' : 'solid'" color="neutral" :loading="answering" @click="answerAvailability(false)">
              Confirmer : pas disponible
            </UButton>
          </div>
        </UCard>
        <UAlert v-if="availabilityGone" color="warning" variant="soft" description="Cette session n’est plus proposée." />
        <UAlert v-if="availabilityError" color="error" variant="soft" :description="availabilityError" />
        <UAlert v-if="availabilityKept" color="warning" variant="soft" description="Vous avez une place pour cette session : votre réponse ne la change pas. Si vous ne pouvez plus venir, annulez votre présence ci-dessous." />

        <!-- Statut session par session (R17, R28) -->
        <UCard v-if="details.sessions.length">
          <h2 class="font-semibold">Vos sessions</h2>
          <UAlert v-if="sessionError" class="mt-3" color="error" variant="soft" :description="sessionError" />
          <ul class="mt-2 divide-y divide-gray-100">
            <li v-for="line in details.sessions" :key="line.sessionId" class="space-y-2 py-3 text-sm" :data-session="line.session.name">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ line.session.name }}</span>
                <span v-if="line.session.date" class="text-gray-600">{{ formatLongDate(line.session.date) }}</span>
                <UBadge :color="lineMeta(line).color" variant="subtle" size="sm">{{ lineMeta(line).label }}</UBadge>
              </div>
              <p v-if="line.session.location" class="text-gray-600">{{ line.session.location.name }}<span v-if="line.session.location.address">, {{ line.session.location.address }}</span></p>
              <p v-if="line.status === LINE.waitlisted" class="text-gray-600">Si une place se libère, l’équipe d’organisation vous écrira.</p>
              <p v-if="line.status === LINE.transferred" class="text-gray-600">Cette session est reportée : votre place est passée à la nouvelle session.</p>
              <template v-if="line.canConfirmPlace">
                <p class="text-gray-600">
                  Votre place est retenue. Confirmez-la<span v-if="line.responseDueAt"> avant le {{ formatLongDate(line.responseDueAt) }}</span> : vous rejoindrez alors la session.
                </p>
                <p v-if="line.overdue" class="text-warning-600">Le délai est dépassé : vous pouvez encore confirmer tant que l’équipe n’a pas attribué votre place à quelqu’un d’autre.</p>
              </template>
              <div class="flex flex-wrap gap-2">
                <UButton v-if="line.canConfirmPlace" size="sm" color="primary" icon="i-heroicons-check" :loading="busySession === line.sessionId" @click="confirmPlace(line.sessionId)">
                  Je confirme ma place
                </UButton>
                <UButton v-if="line.canCancel" size="sm" color="error" variant="soft" :loading="busySession === line.sessionId" @click="cancelSession(line.sessionId, line.session.name)">
                  Annuler ma présence
                </UButton>
              </div>
            </li>
          </ul>
        </UCard>

        <UCard>
          <h2 class="font-semibold">Note d’intention</h2>
          <p v-if="details.game.noteIntention" class="mt-2 whitespace-pre-line text-sm text-gray-700">{{ details.game.noteIntention }}</p>
          <p v-else class="mt-2 text-sm italic text-gray-500">Le jeu n’a pas de note d’intention.</p>
          <!-- Usage des photos (US-107) -->
          <p v-if="details.game.photoInformation" class="mt-3 text-xs text-gray-500">{{ details.game.photoInformation }}</p>
        </UCard>

        <UCard>
          <form class="space-y-5" novalidate @submit.prevent="submit">
            <h2 class="font-semibold">Vos informations</h2>

            <RegistrationAnswerFields
              v-model:form="form"
              :definition="details.definition"
              :availability-sessions="details.availability?.sessions ?? null"
              :disabled="readOnly"
              :email-locked="!personalLink"
              :errors="fieldErrors"
            />

            <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" />

            <div v-if="!readOnly" class="flex flex-wrap gap-2">
              <UButton type="submit" color="primary" :loading="saving">
                {{ details.canAccept ? 'Envoyer mes réponses' : 'Enregistrer les modifications' }}
              </UButton>
              <UButton
                v-if="details.canDecline"
                type="button"
                color="neutral"
                variant="soft"
                :loading="declining"
                @click="decline"
              >
                Décliner l’invitation
              </UButton>
            </div>
          </form>
        </UCard>

        <UCard v-if="details.canLeave">
          <h2 class="font-semibold">Quitter le vivier</h2>
          <p class="mt-2 text-sm text-gray-600">
            Si vous ne souhaitez plus du tout participer à ce jeu, quittez le vivier : vos présences aux sessions à venir seront annulées et ce lien ne marchera plus.
            Pour une seule session, annulez plutôt votre présence ci-dessus. Vous pourrez revenir en remplissant de nouveau le questionnaire.
          </p>
          <UButton class="mt-3" color="error" variant="soft" :loading="withdrawing" @click="withdraw">
            Quitter le vivier
          </UButton>
        </UCard>
      </template>
      <!-- Pages légales (US-110) -->
      <LegalLinks class="mt-8" />
  </div>
</template>

<script setup lang="ts">
import { REGISTRATION_SESSION_STATUSES as LINE, REGISTRATION_SESSION_STATUS_META, REGISTRATION_STATUS_META, SESSION_STATUSES, metaOf } from '~/utils/domain'
import { apiErrorMessage, apiFieldErrors, loadErrorMessage } from '~/utils/apiErrors'
import { getErrorStatus } from '~/utils/connection'
import { emptyRegistrationAnswerForm } from '~/utils/registrationForms'
import { formatLongDate } from '~/utils/dates'
import { handleApiAuthError, publicFetch, type ApiResponse } from '~/composables/useApiFetch'

// Réponse à une inscription (US-004) : par le lien personnel, ou depuis le compte (US-072).
// endpoint : /api/public/registrations/:jeton ou /api/me/registrations/:id, qui répondent de la même façon
type Exposed = ApiResponse<'/api/public/registrations/:token'>
type Saved = ApiResponse<'/api/public/registrations/:token', 'put'>

const props = withDefaults(defineProps<{
  endpoint: string
  personalLink?: boolean
  // Réponse portée par le lien de l'email (R11), à confirmer
  availabilityRequest?: { sessionId: string, available: boolean } | null
}>(), { personalLink: true, availabilityRequest: null })

const loading = ref(true)
const invalid = ref(false)
const loadError = ref('')
const registration = ref<Exposed | null>(null)
// Une inscription désistée n'expose que son jeu et la raison ; les autres, tout le formulaire
const details = computed(() => registration.value && 'answers' in registration.value ? registration.value : null)
const withdrawn = computed(() => registration.value && 'withdrawalReason' in registration.value ? registration.value : null)
const form = ref(emptyRegistrationAnswerForm())
const saving = ref(false)
const declining = ref(false)
const withdrawing = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
const successMessage = ref('')
const successDetail = ref('')
const busySession = ref<string | null>(null)
const sessionError = ref('')
const keptSessions = ref<string[]>([])

// Les sous-routes répondent l'inscription telle que la personne la voit
const answering = ref(false)
const availabilityDone = ref(false)
const availabilityError = ref('')
const availabilityKept = ref(false)
const requestedSession = computed(() => {
  const sessionId = props.availabilityRequest?.sessionId
  if (!sessionId || !details.value?.canEdit) return null
  return details.value.availability?.sessions.find((session) => session.id === sessionId)
    ?? details.value.sessions.find((line) => line.sessionId === sessionId && line.session.status === SESSION_STATUSES.scheduled)?.session
    ?? null
})
const availabilityPrompt = computed(() => availabilityDone.value ? null : requestedSession.value)
const availabilityGone = computed(() => Boolean(props.availabilityRequest && details.value?.canEdit && !availabilityDone.value && !requestedSession.value))

async function answerAvailability(available: boolean) {
  answering.value = true
  availabilityError.value = ''
  successMessage.value = ''
  successDetail.value = ''
  try {
    const result = await publicFetch<Exposed & { availabilityEffect: string }>(`${props.endpoint}/availability`, { method: 'POST', body: { sessionId: props.availabilityRequest!.sessionId, available } })
    apply(result)
    availabilityDone.value = true
    availabilityKept.value = result.availabilityEffect === 'kept'
    // Aucun détail de plus : une décision pas encore annoncée ne se devine pas (R28)
    if (!availabilityKept.value) successMessage.value = 'Votre réponse est enregistrée.'
  } catch (err) {
    availabilityError.value = apiErrorMessage(err, 'Votre réponse n’a pas pu être enregistrée.')
  } finally {
    answering.value = false
  }
}

const post = (action: string, body?: { sessionId: string }) => publicFetch<Exposed>(`${props.endpoint}/${action}`, { method: 'POST', body })

onMounted(load)

async function load() {
  try {
    apply(await publicFetch<Exposed>(props.endpoint))
  } catch (err) {
    // Depuis le compte, une session expirée renvoie à l'écran de connexion (revue de la PR #197)
    if (!props.personalLink) handleApiAuthError(err)
    // Seul un refus 404 dit l'inscription introuvable ; le réseau ou une panne le disent autrement (US-218)
    if (getErrorStatus(err) !== 404) {
      loadError.value = loadErrorMessage(err, 'Impossible de charger cette inscription. Réessayez dans quelques minutes.')
      return
    }
    // Lien reçu après le formulaire public (US-085) : l'ouvrir confirme l'adresse, puis l'inscription s'affiche
    const confirmed = props.personalLink ? await post('confirm').catch(() => null) : null
    if (confirmed) {
      apply(confirmed)
      successMessage.value = 'Votre adresse est confirmée : votre réponse est reçue.'
      successDetail.value = 'Gardez l’email reçu : son lien vous permet de revenir modifier vos réponses à tout moment.'
    } else {
      invalid.value = true
    }
  } finally {
    loading.value = false
  }
}


function apply(data: Exposed) {
  registration.value = data
  if ('answers' in data) form.value = { ...form.value, ...data.answers }
}

const WITHDRAWAL_MESSAGES: Record<string, string> = {
  declined: 'Vous avez décliné l’invitation.',
  released: 'Sans réponse de votre part dans le délai, votre invitation a été retirée.',
  removed: 'L’équipe d’organisation vous a retiré·e du vivier de ce jeu.',
  left: 'Vous avez quitté le vivier de ce jeu. Pour y revenir, remplissez de nouveau le questionnaire.'
}
const withdrawalMessage = computed(() => WITHDRAWAL_MESSAGES[withdrawn.value?.withdrawalReason ?? ''] || WITHDRAWAL_MESSAGES.declined)

const statusMeta = computed(() => metaOf(REGISTRATION_STATUS_META, registration.value?.status ?? '') ?? { label: '', color: 'neutral' as const })
const lineMeta = (line: { status: string, validated: boolean }) => metaOf(REGISTRATION_SESSION_STATUS_META, line.validated ? 'validated' : line.status) ?? { label: line.status, color: 'neutral' as const }
const readOnly = computed(() => !details.value?.canAccept && !details.value?.canEdit)


function showError(err: unknown, fallback: string) {
  fieldErrors.value = apiFieldErrors(err)
  errorMessage.value = Object.keys(fieldErrors.value).length
    ? 'Certaines informations sont manquantes ou incorrectes.'
    : apiErrorMessage(err, fallback)
}

async function submit() {
  const accepting = details.value?.canAccept
  saving.value = true
  errorMessage.value = ''
  fieldErrors.value = {}
  successMessage.value = ''
  try {
    const result = await publicFetch<Saved>(props.endpoint, { method: 'PUT', body: { ...form.value } })
    apply(result)
    keptSessions.value = 'keptSessions' in result ? result.keptSessions : []
    successMessage.value = accepting ? 'Vos réponses sont enregistrées.' : 'Vos modifications sont enregistrées.'
    successDetail.value = accepting
      ? result.emailSent
        ? props.personalLink
          ? 'Un email de confirmation vous a été envoyé, avec ce même lien pour revenir modifier vos réponses à tout moment.'
          : 'Un email de confirmation vous a été envoyé. Vous pouvez revenir modifier vos réponses depuis votre compte à tout moment.'
        : props.personalLink ? 'Gardez ce lien : il vous permet de revenir modifier vos réponses à tout moment.' : ''
      : ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    showError(err, 'Enregistrement impossible. Réessayez dans quelques minutes.')
  } finally {
    saving.value = false
  }
}

async function decline() {
  if (!confirm('Décliner l’invitation ? Vous ne pourrez plus revenir sur cette réponse.')) return
  declining.value = true
  errorMessage.value = ''
  try {
    apply(await post('decline'))
  } catch (err) {
    showError(err, 'Impossible de décliner. Réessayez dans quelques minutes.')
  } finally {
    declining.value = false
  }
}

async function confirmPlace(sessionId: string) {
  busySession.value = sessionId
  sessionError.value = ''
  successMessage.value = ''
  try {
    apply(await post('accept', { sessionId }))
    successMessage.value = 'Votre place est confirmée.'
    successDetail.value = 'L’équipe d’organisation vous retrouvera parmi les participants de la session.'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    sessionError.value = apiErrorMessage(err, 'Confirmation impossible. Réessayez dans quelques minutes.')
  } finally {
    busySession.value = null
  }
}

// Une seule session : la personne reste dans le vivier (R19)
async function cancelSession(sessionId: string, name: string) {
  if (!confirm(`Annuler votre présence à « ${name} » ? L’équipe sera prévenue, et vous restez dans le vivier du jeu. Pour un paiement déjà effectué, voyez directement avec elle.`)) return
  busySession.value = sessionId
  sessionError.value = ''
  successMessage.value = ''
  try {
    apply(await post('cancel', { sessionId }))
    keptSessions.value = []
    successMessage.value = 'Votre présence est annulée.'
    successDetail.value = 'Vous restez dans le vivier du jeu.'
  } catch (err) {
    sessionError.value = apiErrorMessage(err, 'Annulation impossible. Réessayez dans quelques minutes.')
  } finally {
    busySession.value = null
  }
}

async function withdraw() {
  if (!confirm('Quitter le vivier ? Vos présences aux sessions à venir seront annulées et ce lien ne marchera plus. Vous pourrez revenir en remplissant de nouveau le questionnaire.')) return
  withdrawing.value = true
  errorMessage.value = ''
  try {
    apply(await post('withdraw'))
  } catch (err) {
    showError(err, 'Impossible de quitter le vivier. Réessayez dans quelques minutes.')
  } finally {
    withdrawing.value = false
  }
}
</script>
