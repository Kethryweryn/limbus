<template>
  <div class="space-y-6">
      <p v-if="loading" class="text-sm text-gray-500">Chargement…</p>

      <UCard v-else-if="invalid">
        <h1 class="text-xl font-semibold">{{ personalLink ? 'Lien invalide' : 'Inscription introuvable' }}</h1>
        <p class="mt-2 text-sm text-gray-600">
          {{ personalLink ? 'Ce lien n’est pas valide.' : 'Cette inscription est introuvable.' }} Si vous pensez qu’il s’agit d’une erreur, contactez l’équipe d’organisation du jeu.
        </p>
      </UCard>

      <UCard v-else-if="registration?.status === REGISTRATION_STATUSES.withdrawn">
        <h1 class="text-xl font-semibold">{{ registration.game.title }}</h1>
        <p class="mt-2 text-sm text-gray-600">
          {{ withdrawalMessage }}
          {{ personalLink ? 'Ce lien ne permet plus rien.' : 'Cette inscription ne permet plus rien.' }} Pour toute question, contactez l’équipe d’organisation du jeu.
        </p>
      </UCard>

      <template v-else-if="registration">
        <UCard>
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold">{{ registration.game.title }}</h1>
              <UBadge :color="statusMeta.color" variant="subtle">{{ statusMeta.label }}</UBadge>
            </div>
            <p v-if="registration.session" class="text-sm text-gray-600">
              Session {{ registration.session.name }}<span v-if="registration.session.date"> · {{ formatDate(registration.session.date) }}</span>
              <span v-if="registration.session.location"> · {{ registration.session.location.name }}<span v-if="registration.session.location.address">, {{ registration.session.location.address }}</span></span>
            </p>
            <p v-if="registration.canAccept && registration.responseDueAt" class="text-sm text-gray-600">
              Réponse attendue avant le {{ formatDate(registration.responseDueAt) }}.
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
          v-if="registration.overdue"
          color="warning"
          variant="soft"
          description="Le délai de réponse est dépassé. Vous pouvez encore accepter tant que l’équipe d’organisation n’a pas attribué votre place à quelqu’un d’autre."
        />
        <UAlert
          v-if="registration.status === REGISTRATION_STATUSES.confirmed && !registration.canEdit"
          color="neutral"
          variant="soft"
          description="Les inscriptions sont closes : vos informations ne peuvent plus être modifiées. Pour toute correction, contactez l’équipe d’organisation."
        />

        <UCard>
          <h2 class="font-semibold">Note d’intention</h2>
          <p v-if="registration.game.noteIntention" class="mt-2 whitespace-pre-line text-sm text-gray-700">{{ registration.game.noteIntention }}</p>
          <p v-else class="mt-2 text-sm italic text-gray-500">Le jeu n’a pas de note d’intention.</p>
        </UCard>

        <UCard>
          <form class="space-y-5" @submit.prevent="submit">
            <h2 class="font-semibold">Vos informations</h2>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="Email" required :error="fieldError('email')">
                <UInput v-model="form.email" type="email" autocomplete="email" :disabled="readOnly || !personalLink" class="w-full" />
              </UFormField>
              <UFormField
                v-for="field in textFields"
                :key="field.key"
                :label="field.label"
                :required="field.required"
                :error="fieldError(field.key)"
                :class="field.wide ? 'sm:col-span-2' : ''"
              >
                <UTextarea v-if="field.multiline" v-model="form[field.key]" :rows="3" :disabled="readOnly" class="w-full" />
                <UInput v-else v-model="form[field.key]" :type="field.type || 'text'" :autocomplete="field.autocomplete" :disabled="readOnly" class="w-full" />
              </UFormField>
            </div>

            <UFormField
              v-if="registration.availability"
              label="Sessions où vous êtes disponible"
              required
              :error="fieldError('availableSessionIds')"
            >
              <!-- Un groupe, pas des cases isolées : dans un champ, chaque case prendrait le libellé du champ -->
              <UCheckboxGroup v-model="form.availableSessionIds" :items="sessionItems" :disabled="readOnly" />
            </UFormField>

            <RegistrationExtraFields
              v-model:affinities="form.affinities"
              v-model:answers="form.questionAnswers"
              :definition="registration.definition"
              :disabled="readOnly"
              :errors="fieldErrors"
            />

            <UFormField v-if="registration.definition.standardFields.dietary.asked" :error="fieldError('healthConsent')">
              <UCheckbox
                v-model="form.healthConsent"
                :disabled="readOnly"
                label="J’accepte que ces informations de santé soient transmises aux organisateurs et à l’équipe cuisine (obligatoire si je déclare des allergies)"
              />
            </UFormField>
            <UFormField :error="fieldError('charterAccepted')">
              <UCheckbox v-model="form.charterAccepted" :disabled="readOnly" label="J’ai lu la note d’intention et j’y adhère" required />
            </UFormField>

            <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" />

            <div v-if="!readOnly" class="flex flex-wrap gap-2">
              <UButton type="submit" color="primary" :loading="saving">
                {{ registration.canAccept ? 'Accepter l’invitation' : 'Enregistrer les modifications' }}
              </UButton>
              <UButton
                v-if="registration.canDecline"
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

        <UCard v-if="registration.canWithdraw && registration.status === REGISTRATION_STATUSES.received">
          <h2 class="font-semibold">Retirer mon inscription</h2>
          <p class="mt-2 text-sm text-gray-600">
            Votre inscription est reçue par l’équipe d’organisation, qui n’a pas encore choisi les personnes retenues.
            Si vous ne souhaitez plus participer, retirez-la.
          </p>
          <UButton class="mt-3" color="error" variant="soft" :loading="withdrawing" @click="withdraw">
            Retirer mon inscription
          </UButton>
        </UCard>
        <UCard v-else-if="registration.canWithdraw">
          <h2 class="font-semibold">Me désister</h2>
          <p class="mt-2 text-sm text-gray-600">
            Si vous ne pouvez plus venir, prévenez l’équipe d’organisation en vous désistant : votre place sera libérée.
            Pour un paiement déjà effectué, voyez directement avec elle.
          </p>
          <UButton class="mt-3" color="error" variant="soft" :loading="withdrawing" @click="withdraw">
            Me désister
          </UButton>
        </UCard>
      </template>
  </div>
</template>

<script setup>
import { REGISTRATION_STATUS_META, REGISTRATION_STATUSES } from '~/utils/domain'
import { apiErrorMessage, apiFieldErrors } from '~/utils/apiErrors'
import { REGISTRATION_FORM_INPUTS } from '~/utils/registrationForms'

// Réponse à une inscription (US-004) : par le lien personnel, ou depuis le compte (US-072).
// endpoint : /api/public/registrations/:jeton ou /api/me/registrations/:id, qui répondent de la même façon
const props = defineProps({
  endpoint: { type: String, required: true },
  personalLink: { type: Boolean, default: true }
})

const loading = ref(true)
const invalid = ref(false)
const registration = ref(null)
const form = reactive({})
const saving = ref(false)
const declining = ref(false)
const withdrawing = ref(false)
const errorMessage = ref('')
const fieldErrors = ref({})
const successMessage = ref('')
const successDetail = ref('')

onMounted(load)

async function load() {
  try {
    apply(await $fetch(props.endpoint))
  } catch {
    // Lien reçu après le formulaire public (US-085) : l'ouvrir confirme l'adresse, puis l'inscription s'affiche
    const confirmed = props.personalLink ? await $fetch(`${props.endpoint}/confirm`, { method: 'POST' }).catch(() => null) : null
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

const sessionItems = computed(() => (registration.value?.availability?.sessions || []).map((session) => ({
  value: session.id,
  label: session.date ? `${session.name} · ${formatDate(session.date)}` : session.name
})))

function apply(data) {
  registration.value = data
  if (data.answers) Object.assign(form, { ...data.answers })
}

const WITHDRAWAL_MESSAGES = {
  declined: 'Vous avez décliné l’invitation.',
  withdrawn: 'Vous vous êtes désisté·e.',
  released: 'Sans réponse de votre part dans le délai, votre place a été réattribuée.',
  removed: 'L’équipe d’organisation a annulé votre inscription.',
  retracted: 'Vous avez retiré votre inscription.'
}
const withdrawalMessage = computed(() => WITHDRAWAL_MESSAGES[registration.value?.withdrawalReason] || WITHDRAWAL_MESSAGES.declined)

const statusMeta = computed(() => REGISTRATION_STATUS_META[registration.value?.status] || { label: '', color: 'neutral' })
const readOnly = computed(() => !registration.value?.canAccept && !registration.value?.canEdit)

// Champs demandés, dans l'ordre de l'aperçu du formulaire (US-002)
const textFields = computed(() => {
  const settings = registration.value?.definition.standardFields || {}
  return REGISTRATION_FORM_INPUTS
    .filter((input) => settings[input.setting]?.asked)
    .map((input) => ({ ...input, required: settings[input.setting].required }))
})

function fieldError(key) {
  return fieldErrors.value[key]
}

function showError(err, fallback) {
  fieldErrors.value = apiFieldErrors(err)
  errorMessage.value = Object.keys(fieldErrors.value).length
    ? 'Certaines informations sont manquantes ou incorrectes.'
    : apiErrorMessage(err, fallback)
}

async function submit() {
  const accepting = registration.value.canAccept
  saving.value = true
  errorMessage.value = ''
  fieldErrors.value = {}
  successMessage.value = ''
  try {
    const result = await $fetch(props.endpoint, { method: 'PUT', body: { ...form } })
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
    apply(await $fetch(`${props.endpoint}/decline`, { method: 'POST' }))
  } catch (err) {
    showError(err, 'Impossible de décliner. Réessayez dans quelques minutes.')
  } finally {
    declining.value = false
  }
}

async function withdraw() {
  const received = registration.value.status === REGISTRATION_STATUSES.received
  if (!confirm(received
    ? 'Retirer votre inscription ? Vous pourrez vous réinscrire par le formulaire tant que les inscriptions sont ouvertes.'
    : 'Vous désister ? Votre place sera libérée et vous ne pourrez plus revenir sur votre inscription.')) return
  withdrawing.value = true
  errorMessage.value = ''
  try {
    apply(await $fetch(`${props.endpoint}/withdraw`, { method: 'POST' }))
  } catch (err) {
    showError(err, 'Impossible de vous désister. Réessayez dans quelques minutes.')
  } finally {
    withdrawing.value = false
  }
}

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long' })
</script>
