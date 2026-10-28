<template>
  <main class="light min-h-screen bg-gray-50 px-4 py-8 text-gray-900" style="color-scheme: light;">
    <div class="mx-auto max-w-2xl space-y-6">
      <p v-if="loading" class="text-sm text-gray-500">Chargement…</p>

      <UCard v-else-if="invalid">
        <h1 class="text-xl font-semibold">Lien invalide</h1>
        <p class="mt-2 text-sm text-gray-600">
          Ce lien n’est pas valide. Si vous pensez qu’il s’agit d’une erreur, contactez l’équipe d’organisation du jeu.
        </p>
      </UCard>

      <UCard v-else-if="registration?.status === REGISTRATION_STATUSES.withdrawn">
        <h1 class="text-xl font-semibold">{{ registration.game.title }}</h1>
        <p class="mt-2 text-sm text-gray-600">
          {{ registration.withdrawnAfterConfirmation ? 'Vous vous êtes désisté·e.' : 'Vous avez décliné l’invitation.' }}
          Ce lien ne permet plus rien. Pour toute question, contactez l’équipe d’organisation du jeu.
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
                <UInput v-model="form.email" type="email" autocomplete="email" :disabled="readOnly" class="w-full" />
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

        <UCard v-if="registration.canWithdraw">
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
  </main>
</template>

<script setup>
import { REGISTRATION_STATUS_META, REGISTRATION_STATUSES } from '~/utils/domain'

// Page du lien personnel d'une personne invitée (US-004), sans compte : le jeton de l'URL fait foi.
// Chargée côté navigateur seulement, sans le cache hors ligne de l'application.
definePageMeta({
  layout: false,
  colorMode: 'light'
})

useHead({
  title: 'Inscription - Limbus',
  meta: [
    { name: 'referrer', content: 'no-referrer' },
    { name: 'robots', content: 'noindex' },
    { name: 'color-scheme', content: 'light' }
  ],
  htmlAttrs: { class: 'light', 'data-color-mode-forced': 'light' },
  bodyAttrs: { class: 'bg-gray-50 text-gray-900' }
})

const route = useRoute()
const endpoint = `/api/public/registrations/${encodeURIComponent(String(route.params.token || ''))}`

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
    apply(await $fetch(endpoint))
  } catch {
    invalid.value = true
  } finally {
    loading.value = false
  }
}

function apply(data) {
  registration.value = data
  if (data.answers) Object.assign(form, { ...data.answers })
}

const statusMeta = computed(() => REGISTRATION_STATUS_META[registration.value?.status] || { label: '', color: 'neutral' })
const readOnly = computed(() => !registration.value?.canAccept && !registration.value?.canEdit)

// Champs demandés, dans l'ordre de l'aperçu du formulaire (US-002)
const textFields = computed(() => {
  const settings = registration.value?.definition.standardFields || {}
  const fields = []
  const add = (setting, key, label, extra = {}) => {
    if (settings[setting]?.asked) fields.push({ key, label, required: settings[setting].required, ...extra })
  }
  add('lastName', 'lastName', 'Nom', { autocomplete: 'family-name' })
  add('firstName', 'firstName', 'Prénom', { autocomplete: 'given-name' })
  add('phone', 'phone', 'Téléphone', { type: 'tel', autocomplete: 'tel' })
  add('facebookName', 'facebookName', 'Nom Facebook')
  add('emergencyContact', 'emergencyContactName', 'Contact d’urgence : nom')
  add('emergencyContact', 'emergencyContactPhone', 'Contact d’urgence : téléphone', { type: 'tel' })
  add('dietary', 'dietary', 'Allergies et intolérances alimentaires', { wide: true, multiline: true })
  return fields
})

function fieldError(key) {
  return fieldErrors.value[key]
}

// Erreur de validation : h3 range le détail zod sous data.data
function showError(err, fallback) {
  const issues = err?.data?.data?.data
  if (Array.isArray(issues)) {
    fieldErrors.value = Object.fromEntries(issues.map((issue) => [issue.path, issue.message]))
    errorMessage.value = 'Certaines informations sont manquantes ou incorrectes.'
  } else {
    errorMessage.value = err?.data?.message || fallback
  }
}

async function submit() {
  const accepting = registration.value.canAccept
  saving.value = true
  errorMessage.value = ''
  fieldErrors.value = {}
  successMessage.value = ''
  try {
    const result = await $fetch(endpoint, { method: 'PUT', body: { ...form } })
    apply(result)
    successMessage.value = accepting ? 'Votre inscription est confirmée.' : 'Vos modifications sont enregistrées.'
    successDetail.value = accepting
      ? result.emailSent
        ? 'Un email de confirmation vous a été envoyé, avec ce même lien pour revenir modifier vos informations jusqu’à la clôture.'
        : 'Gardez ce lien : il vous permet de revenir modifier vos informations jusqu’à la clôture.'
      : ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    showError(err, 'Enregistrement impossible. Réessayez dans quelques minutes.')
  } finally {
    saving.value = false
  }
}

async function decline() {
  if (!confirm('Décliner l’invitation ? Vous ne pourrez plus revenir sur cette réponse par ce lien.')) return
  declining.value = true
  errorMessage.value = ''
  try {
    apply(await $fetch(`${endpoint}/decline`, { method: 'POST' }))
  } catch (err) {
    showError(err, 'Impossible de décliner. Réessayez dans quelques minutes.')
  } finally {
    declining.value = false
  }
}

async function withdraw() {
  if (!confirm('Vous désister ? Votre place sera libérée et ce lien ne permettra plus de revenir sur votre inscription.')) return
  withdrawing.value = true
  errorMessage.value = ''
  try {
    apply(await $fetch(`${endpoint}/withdraw`, { method: 'POST' }))
  } catch (err) {
    showError(err, 'Impossible de vous désister. Réessayez dans quelques minutes.')
  } finally {
    withdrawing.value = false
  }
}

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long' })
</script>
