<template>
  <main class="light min-h-screen bg-gray-50 px-4 py-8 text-gray-900" style="color-scheme: light;">
    <div class="mx-auto max-w-2xl space-y-6">
      <UCard v-if="!period">
        <h1 class="text-xl font-semibold">Lien invalide</h1>
        <p class="mt-2 text-sm text-gray-600">Ce lien d’inscription n’est pas valide. Si vous pensez qu’il s’agit d’une erreur, contactez l’équipe d’organisation du jeu.</p>
      </UCard>

      <template v-else>
        <UCard>
          <div class="space-y-2">
            <h1 class="text-xl font-semibold">{{ period.game.title }}</h1>
            <p class="text-sm text-gray-600">{{ period.permanent ? 'Inscription permanente' : period.name }}</p>
            <div v-if="period.sessions.length" class="text-sm text-gray-700">
              <p class="font-medium">{{ period.permanent ? 'Prochaines sessions' : period.sessions.length > 1 ? 'Sessions' : 'Session' }}</p>
              <ul class="list-disc pl-5">
                <li v-for="session in period.sessions" :key="session.id">
                  {{ session.name }}<span v-if="session.date"> · {{ formatDate(session.date) }}</span>
                  <span v-if="session.location"> · {{ session.location.name }}</span>
                </li>
              </ul>
              <p v-if="period.permanent" class="mt-1 text-xs text-gray-500">
                Vous rejoignez les personnes intéressées par le jeu : l’équipe choisit ensuite pour chaque session.
              </p>
            </div>
          </div>
        </UCard>

        <UCard v-if="period.state !== 'open'">
          <h2 class="font-semibold">Inscriptions closes</h2>
          <p class="mt-2 text-sm text-gray-600">Les inscriptions à ce jeu sont closes. Pour toute question, contactez l’équipe d’organisation.</p>
        </UCard>

        <UAlert
          v-else-if="result"
          color="success"
          variant="soft"
          :title="result.received ? 'Votre inscription est reçue.' : result.alreadyRegistered ? 'Vous êtes déjà inscrit·e.' : 'Vérifiez votre boîte mail.'"
          :description="result.received || result.alreadyRegistered
            ? 'Vous retrouvez votre inscription dans votre espace « Je participe ».'
            : result.emailSent
              ? 'Un email vient de vous être envoyé : ouvrez le lien qu’il contient pour confirmer votre adresse. Sans confirmation, l’inscription n’est pas transmise à l’équipe.'
              : 'L’email de confirmation n’a pas pu partir. Réessayez dans quelques minutes.'"
        />

        <template v-else>
          <UCard>
            <h2 class="font-semibold">Note d’intention</h2>
            <p v-if="period.game.noteIntention" class="mt-2 whitespace-pre-line text-sm text-gray-700">{{ period.game.noteIntention }}</p>
            <p v-else class="mt-2 text-sm italic text-gray-500">Le jeu n’a pas de note d’intention.</p>
          </UCard>

          <UCard>
            <form class="space-y-5" @submit.prevent="submit">
              <h2 class="font-semibold">Vos informations</h2>
              <p v-if="period.account" class="text-sm text-gray-600">
                Vous êtes connecté·e : vos coordonnées viennent de votre compte, et votre inscription sera reçue sans email de confirmation.
              </p>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UFormField label="Email" required :error="fieldErrors.email">
                  <UInput v-model="form.email" type="email" autocomplete="email" :disabled="Boolean(period.account)" class="w-full" />
                </UFormField>
                <UFormField
                  v-for="field in textFields"
                  :key="field.key"
                  :label="field.label"
                  :required="field.required"
                  :error="fieldErrors[field.key]"
                  :class="field.wide ? 'sm:col-span-2' : ''"
                >
                  <UTextarea v-if="field.multiline" v-model="form[field.key]" :rows="3" class="w-full" />
                  <UInput v-else v-model="form[field.key]" :type="field.type || 'text'" :autocomplete="field.autocomplete" class="w-full" />
                </UFormField>
              </div>

              <UFormField
                v-if="period.asksAvailability"
                label="Sessions où vous êtes disponible"
                required
                :error="fieldErrors.availableSessionIds"
              >
                <!-- Un groupe, pas des cases isolées : dans un champ, chaque case prendrait le libellé du champ -->
                <UCheckboxGroup v-model="form.availableSessionIds" :items="sessionItems" />
              </UFormField>

              <RegistrationExtraFields
                v-model:affinities="form.affinities"
                v-model:answers="form.questionAnswers"
                :definition="period.definition"
                :errors="fieldErrors"
              />

              <!-- Champ piège : invisible, seul un robot le remplit -->
              <div class="hidden" aria-hidden="true">
                <label>Site web <input v-model="form.website" type="text" tabindex="-1" autocomplete="off"></label>
              </div>

              <UFormField v-if="period.definition.standardFields.dietary.asked" :error="fieldErrors.healthConsent">
                <UCheckbox
                  v-model="form.healthConsent"
                  label="J’accepte que ces informations de santé soient transmises aux organisateurs et à l’équipe cuisine (obligatoire si je déclare des allergies)"
                />
              </UFormField>
              <UFormField :error="fieldErrors.charterAccepted">
                <UCheckbox v-model="form.charterAccepted" label="J’ai lu la note d’intention et j’y adhère" required />
              </UFormField>

              <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" />

              <UButton type="submit" color="primary" :loading="saving">M’inscrire</UButton>
            </form>
          </UCard>
        </template>
      </template>
    </div>
  </main>
</template>

<script setup>
import { REGISTRATION_FORM_INPUTS } from '~/utils/registrationForms'
import { apiErrorMessage, apiFieldErrors } from '~/utils/apiErrors'

// Lien de diffusion d'une période en mode formulaire (US-084, R32) : rendu côté serveur pour l'aperçu des réseaux sociaux
definePageMeta({
  layout: false,
  colorMode: 'light'
})

const route = useRoute()
const publicId = encodeURIComponent(String(route.params.publicId || ''))
// Le cookie suit la requête faite au rendu : une personne connectée voit le formulaire prérempli
const { data: period } = await useFetch(`/api/public/periods/${publicId}`, { headers: useRequestHeaders(['cookie']), key: `form-${publicId}` })

const form = reactive({
  email: '',
  firstName: '',
  lastName: '',
  facebookName: '',
  phone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  dietary: '',
  healthConsent: false,
  charterAccepted: false,
  availableSessionIds: [],
  affinities: {},
  questionAnswers: {},
  website: ''
})
if (period.value?.account) Object.assign(form, period.value.account)

const saving = ref(false)
const errorMessage = ref('')
const fieldErrors = ref({})
const result = ref(null)

const textFields = computed(() => {
  const settings = period.value?.definition.standardFields || {}
  return REGISTRATION_FORM_INPUTS
    .filter((input) => settings[input.setting]?.asked)
    .map((input) => ({ ...input, required: settings[input.setting].required }))
})

const sessionItems = computed(() => (period.value?.sessions || []).map((session) => ({
  value: session.id,
  label: session.date ? `${session.name} · ${formatDate(session.date)}` : session.name
})))

async function submit() {
  saving.value = true
  errorMessage.value = ''
  fieldErrors.value = {}
  try {
    result.value = await $fetch(`/api/public/periods/${publicId}`, { method: 'POST', body: { ...form } })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    fieldErrors.value = apiFieldErrors(err)
    errorMessage.value = Object.keys(fieldErrors.value).length
      ? 'Certaines informations sont manquantes ou incorrectes.'
      : apiErrorMessage(err, 'Inscription impossible. Réessayez dans quelques minutes.')
  } finally {
    saving.value = false
  }
}

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

// Aperçu sur les réseaux sociaux (R32) : nom du jeu, sessions et dates, début de la note d'intention, vignette du teaser
const description = computed(() => {
  if (!period.value) return ''
  const sessions = period.value.sessions.map((session) => session.date ? `${session.name} (${formatDate(session.date)})` : session.name).join(', ')
  const note = (period.value.game.noteIntention || '').replace(/\s+/g, ' ').trim()
  return [sessions, note.length > 200 ? `${note.slice(0, 197)}…` : note].filter(Boolean).join(' · ')
})

useSeoMeta({
  title: () => period.value ? `Inscription : ${period.value.game.title} - Limbus` : 'Inscription - Limbus',
  ogTitle: () => period.value ? `Inscription : ${period.value.game.title}` : 'Inscription',
  ogDescription: () => description.value,
  description: () => description.value,
  ogImage: () => period.value?.ogImageUrl || undefined,
  ogUrl: () => period.value?.url,
  ogType: 'website',
  twitterCard: () => period.value?.ogImageUrl ? 'summary_large_image' : 'summary'
})

useHead({
  meta: [{ name: 'color-scheme', content: 'light' }],
  htmlAttrs: { class: 'light', 'data-color-mode-forced': 'light' },
  bodyAttrs: { class: 'bg-gray-50 text-gray-900' }
})
</script>
