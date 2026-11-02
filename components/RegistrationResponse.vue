<template>
  <div class="space-y-6">
      <p v-if="loading" class="text-sm text-gray-500">Chargement…</p>

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
            <p v-if="details.session" class="text-sm text-gray-600">
              Session {{ details.session.name }}<span v-if="details.session.date"> · {{ formatLongDate(details.session.date) }}</span>
              <span v-if="details.session.location"> · {{ details.session.location.name }}<span v-if="details.session.location.address">, {{ details.session.location.address }}</span></span>
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
          :description="`Le délai de réponse est dépassé. Vous pouvez encore ${details.canConfirmPlace ? 'confirmer' : 'accepter'} tant que l’équipe d’organisation n’a pas attribué votre place à quelqu’un d’autre.`"
        />

        <!-- Place retenue par la sélection, à confirmer d'un bouton (US-089) -->
        <UCard v-if="details.canConfirmPlace">
          <h2 class="font-semibold">Votre place est retenue</h2>
          <p class="mt-2 text-sm text-gray-600">
            Confirmez votre place<span v-if="details.responseDueAt"> avant le {{ formatLongDate(details.responseDueAt) }}</span> : vous rejoindrez alors la session.
            Vos réponses au formulaire restent celles que vous avez données.
          </p>
          <UAlert v-if="confirmError" class="mt-3" color="error" variant="soft" :description="confirmError" />
          <UButton class="mt-3" color="primary" icon="i-heroicons-check" :loading="confirming" @click="confirmPlace">
            Je confirme ma place
          </UButton>
        </UCard>
        <UAlert
          v-else-if="details.status === REGISTRATION_STATUSES.waitlisted"
          color="info"
          variant="soft"
          title="Vous êtes sur liste d’attente"
          :description="`${details.waitlistSessions.length ? `Session${details.waitlistSessions.length > 1 ? 's' : ''} : ${details.waitlistSessions.map(sessionLabel).join(', ')}. ` : ''}Si une place se libère, l’équipe d’organisation vous écrira.`"
        />
        <UAlert
          v-else-if="details.status === REGISTRATION_STATUSES.rejected"
          color="neutral"
          variant="soft"
          description="Votre inscription n’a pas été retenue cette fois-ci. Merci de votre intérêt pour le jeu."
        />
        <UAlert
          v-if="details.status === REGISTRATION_STATUSES.confirmed && !details.canEdit"
          color="neutral"
          variant="soft"
          description="Les inscriptions sont closes : vos informations ne peuvent plus être modifiées. Pour toute correction, contactez l’équipe d’organisation."
        />

        <UCard>
          <h2 class="font-semibold">Note d’intention</h2>
          <p v-if="details.game.noteIntention" class="mt-2 whitespace-pre-line text-sm text-gray-700">{{ details.game.noteIntention }}</p>
          <p v-else class="mt-2 text-sm italic text-gray-500">Le jeu n’a pas de note d’intention.</p>
          <!-- Usage des photos (US-107) -->
          <p v-if="details.game.photoInformation" class="mt-3 text-xs text-gray-500">{{ details.game.photoInformation }}</p>
        </UCard>

        <UCard>
          <form class="space-y-5" @submit.prevent="submit">
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
                {{ details.canAccept ? 'Accepter l’invitation' : 'Enregistrer les modifications' }}
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

        <UCard v-if="details.canWithdraw && details.status === REGISTRATION_STATUSES.received">
          <h2 class="font-semibold">Retirer mon inscription</h2>
          <p class="mt-2 text-sm text-gray-600">
            Votre inscription est reçue par l’équipe d’organisation, qui n’a pas encore choisi les personnes retenues.
            Si vous ne souhaitez plus participer, retirez-la.
          </p>
          <UButton class="mt-3" color="error" variant="soft" :loading="withdrawing" @click="withdraw">
            Retirer mon inscription
          </UButton>
        </UCard>
        <UCard v-else-if="details.canWithdraw && details.status !== REGISTRATION_STATUSES.rejected">
          <h2 class="font-semibold">Me désister</h2>
          <p v-if="details.status === REGISTRATION_STATUSES.waitlisted" class="mt-2 text-sm text-gray-600">
            Si vous ne souhaitez plus participer, désistez-vous : vous quitterez la liste d’attente.
          </p>
          <p v-else class="mt-2 text-sm text-gray-600">
            Si vous ne pouvez plus venir, prévenez l’équipe d’organisation en vous désistant : votre place sera libérée.
            Pour un paiement déjà effectué, voyez directement avec elle.
          </p>
          <UButton class="mt-3" color="error" variant="soft" :loading="withdrawing" @click="withdraw">
            Me désister
          </UButton>
        </UCard>
      </template>
      <!-- Pages légales (US-110) -->
      <LegalLinks class="mt-8" />
  </div>
</template>

<script setup lang="ts">
import { REGISTRATION_STATUS_META, REGISTRATION_STATUSES } from '~/utils/domain'
import { apiErrorMessage, apiFieldErrors } from '~/utils/apiErrors'
import { emptyRegistrationAnswerForm } from '~/utils/registrationForms'
import { formatLongDate } from '~/utils/dates'
import { publicFetch, type ApiResponse } from '~/composables/useApiFetch'

// Réponse à une inscription (US-004) : par le lien personnel, ou depuis le compte (US-072).
// endpoint : /api/public/registrations/:jeton ou /api/me/registrations/:id, qui répondent de la même façon
type Exposed = ApiResponse<'/api/public/registrations/:token'>
type Saved = ApiResponse<'/api/public/registrations/:token', 'put'>

const props = withDefaults(defineProps<{ endpoint: string, personalLink?: boolean }>(), { personalLink: true })

const loading = ref(true)
const invalid = ref(false)
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
const confirming = ref(false)
const confirmError = ref('')

// Les sous-routes répondent l'inscription telle que la personne la voit
const post = (action: string) => publicFetch<Exposed>(`${props.endpoint}/${action}`, { method: 'POST' })

onMounted(load)

async function load() {
  try {
    apply(await publicFetch<Exposed>(props.endpoint))
  } catch {
    // Lien reçu après le formulaire public (US-085) : l'ouvrir confirme l'adresse, puis l'inscription s'affiche
    const confirmed = props.personalLink ? await post('confirm').catch(() => null) : null
    if (confirmed) {
      apply(confirmed)
      successMessage.value = 'Votre adresse est confirmée : votre inscription est reçue.'
      successDetail.value = 'Gardez l’email reçu : son lien vous permet de revenir modifier ou retirer votre inscription.'
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
  withdrawn: 'Vous vous êtes désisté·e.',
  released: 'Sans réponse de votre part dans le délai, votre place a été réattribuée.',
  removed: 'L’équipe d’organisation a annulé votre inscription.',
  retracted: 'Vous avez retiré votre inscription.'
}
const withdrawalMessage = computed(() => WITHDRAWAL_MESSAGES[withdrawn.value?.withdrawalReason ?? ''] || WITHDRAWAL_MESSAGES.declined)

const statusMeta = computed(() => {
  const status = registration.value?.status ?? ''
  return status in REGISTRATION_STATUS_META ? REGISTRATION_STATUS_META[status as keyof typeof REGISTRATION_STATUS_META] : { label: '', color: 'neutral' as const }
})
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
    successMessage.value = accepting ? 'Votre inscription est confirmée.' : 'Vos modifications sont enregistrées.'
    successDetail.value = accepting
      ? result.emailSent
        ? props.personalLink
          ? 'Un email de confirmation vous a été envoyé, avec ce même lien pour revenir modifier vos informations jusqu’à la clôture.'
          : 'Un email de confirmation vous a été envoyé. Vous pouvez revenir modifier vos informations depuis votre compte jusqu’à la clôture.'
        : props.personalLink ? 'Gardez ce lien : il vous permet de revenir modifier vos informations jusqu’à la clôture.' : ''
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

async function confirmPlace() {
  confirming.value = true
  confirmError.value = ''
  successMessage.value = ''
  try {
    apply(await post('accept'))
    successMessage.value = 'Votre place est confirmée.'
    successDetail.value = 'L’équipe d’organisation vous retrouvera parmi les participants de la session.'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    confirmError.value = apiErrorMessage(err, 'Confirmation impossible. Réessayez dans quelques minutes.')
  } finally {
    confirming.value = false
  }
}

async function withdraw() {
  const received = registration.value?.status === REGISTRATION_STATUSES.received
  if (!confirm(received
    ? 'Retirer votre inscription ? Vous pourrez vous réinscrire par le formulaire tant que les inscriptions sont ouvertes.'
    : 'Vous désister ? Votre place sera libérée et vous ne pourrez plus revenir sur votre inscription.')) return
  withdrawing.value = true
  errorMessage.value = ''
  try {
    apply(await post('withdraw'))
  } catch (err) {
    showError(err, 'Impossible de vous désister. Réessayez dans quelques minutes.')
  } finally {
    withdrawing.value = false
  }
}

const sessionLabel = (session: { name: string, date: string | null }) => session.date ? `${session.name} (${formatLongDate(session.date)})` : session.name
</script>
