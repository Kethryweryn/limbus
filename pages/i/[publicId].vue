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
            <p class="text-sm text-gray-600">Vous rejoignez les personnes intéressées par le jeu : l’équipe choisit ensuite pour chaque session.</p>
            <div v-if="period.sessions.length" class="text-sm text-gray-700">
              <p class="font-medium">Prochaines sessions</p>
              <ul class="list-disc pl-5">
                <li v-for="session in period.sessions" :key="session.id">
                  {{ session.name }}<span v-if="session.date"> · {{ formatDate(session.date) }}</span>
                  <span v-if="session.location"> · {{ session.location.name }}</span>
                </li>
              </ul>
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
          :title="result.received ? 'Votre réponse est reçue.' : 'Vérifiez votre boîte mail.'"
          :description="result.received
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
            <!-- Usage des photos (US-107) -->
            <p class="mt-3 text-xs text-gray-500">{{ period.game.photoInformation }}</p>
          </UCard>

          <UCard>
            <form class="space-y-5" novalidate @submit.prevent="submit">
              <h2 class="font-semibold">Vos informations</h2>
              <p v-if="period.account" class="text-sm text-gray-600">
                Vous êtes connecté·e : vos coordonnées viennent de votre compte, et votre inscription sera reçue sans email de confirmation.
              </p>

              <RegistrationAnswerFields
                v-model:form="form"
                :definition="period.definition"
                :availability-sessions="period.sessions.length ? period.sessions : null"
                :email-locked="Boolean(period.account)"
                :errors="fieldErrors"
              >
                <!-- Champ piège : invisible, seul un robot le remplit -->
                <div class="hidden" aria-hidden="true">
                  <label>Site web <input v-model="website" type="text" tabindex="-1" autocomplete="off"></label>
                </div>
              </RegistrationAnswerFields>

              <UAlert v-if="errorMessage" color="error" variant="soft" :description="errorMessage" />

              <UButton type="submit" color="primary" :loading="saving">M’inscrire</UButton>
            </form>
          </UCard>
        </template>
      </template>
      <!-- Pages légales (US-110) -->
      <LegalLinks class="mt-8" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { emptyRegistrationAnswerForm } from '~/utils/registrationForms'
import { apiErrorMessage, apiFieldErrors } from '~/utils/apiErrors'
import { PARIS_TIME_ZONE, formatLongDate } from '~/utils/dates'
import { publicFetch, type ApiResponse } from '~/composables/useApiFetch'

type Submitted = ApiResponse<'/api/public/periods/:publicId', 'post'>

// Lien de diffusion du vivier (US-084, R32) : rendu côté serveur pour l'aperçu des réseaux sociaux
definePageMeta({
  layout: false,
  colorMode: 'light'
})

const route = useRoute()
const publicId = encodeURIComponent(String(route.params.publicId || ''))
// Le cookie suit la requête faite au rendu : une personne connectée voit le formulaire prérempli
const { data: period } = await useFetch(`/api/public/periods/${publicId}`, { headers: useRequestHeaders(['cookie']), key: `form-${publicId}` })

const form = ref({ ...emptyRegistrationAnswerForm(), ...period.value?.account })
// Champ piège : un robot le remplit, le serveur refuse alors l'inscription
const website = ref('')

const saving = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
const result = ref<Submitted | null>(null)


const formatDate = (value: string) => formatLongDate(value, PARIS_TIME_ZONE)


async function submit() {
  saving.value = true
  errorMessage.value = ''
  fieldErrors.value = {}
  try {
    result.value = await publicFetch<Submitted>(`/api/public/periods/${publicId}`, { method: 'POST', body: { ...form.value, website: website.value } })
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
