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

      <UCard v-else-if="attendance">
        <div class="space-y-4">
          <div class="space-y-1">
            <h1 class="text-xl font-semibold">{{ attendance.gameTitle }}</h1>
            <p class="text-sm text-gray-600">
              Bonjour {{ attendance.participantName }}. La session<span v-if="attendance.previousSessionName"> « {{ attendance.previousSessionName }} »</span> est reportée.
            </p>
          </div>

          <div class="rounded border border-gray-200 bg-white p-4 text-sm">
            <div class="font-medium">{{ attendance.sessionName }}</div>
            <div>{{ attendance.sessionDate ? formatDateTime(attendance.sessionDate) : 'Date à préciser' }}</div>
            <div v-if="attendance.location">
              {{ attendance.location.name }}<span v-if="attendance.location.address">, {{ attendance.location.address }}</span>
            </div>
          </div>

          <p v-if="answerLabel" class="text-sm">
            Votre réponse : <strong>{{ answerLabel }}</strong>
            <span v-if="attendance.respondedAt" class="text-gray-500"> (le {{ formatDate(attendance.respondedAt) }})</span>
          </p>

          <template v-if="attendance.canAnswer">
            <p class="text-sm text-gray-600">
              Serez-vous présent·e ? Merci de répondre avant le {{ formatDate(attendance.responseDueAt) }}.
              <span v-if="answerLabel">Vous pouvez changer d’avis jusque-là.</span>
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton color="success" :loading="saving === 'confirmed'" :disabled="Boolean(saving)" @click="answer('confirmed')">
                Je viens
              </UButton>
              <UButton color="error" variant="soft" :loading="saving === 'declined'" :disabled="Boolean(saving)" @click="answer('declined')">
                Je ne viens pas
              </UButton>
            </div>
          </template>
          <p v-else class="text-sm text-gray-600">
            Ce lien ne permet plus de répondre. Pour toute question, contactez l’équipe d’organisation du jeu.
          </p>

          <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
        </div>
      </UCard>
    </div>
  </main>
</template>

<script setup>
import { ATTENDANCE_STATUSES } from '~/utils/attendance'
import { apiErrorMessage } from '~/utils/apiErrors'

// Lien personnel de confirmation de présence à une session reportée (US-024), sans compte : le jeton fait foi.
// Chargée côté navigateur seulement, sans le cache hors ligne de l'application.
definePageMeta({
  layout: false,
  colorMode: 'light'
})

useHead({
  title: 'Confirmation de présence - Limbus',
  meta: [
    { name: 'referrer', content: 'no-referrer' },
    { name: 'robots', content: 'noindex' },
    { name: 'color-scheme', content: 'light' }
  ],
  htmlAttrs: { class: 'light', 'data-color-mode-forced': 'light' },
  bodyAttrs: { class: 'bg-gray-50 text-gray-900' }
})

const route = useRoute()
const endpoint = `/api/public/attendance/${encodeURIComponent(String(route.params.token || ''))}`

const loading = ref(true)
const invalid = ref(false)
const attendance = ref(null)
const saving = ref('')
const errorMessage = ref('')

const answerLabel = computed(() => {
  if (attendance.value?.status === ATTENDANCE_STATUSES.confirmed) return 'je viens'
  if (attendance.value?.status === ATTENDANCE_STATUSES.declined) return 'je ne viens pas'
  return ''
})

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })
const formatDateTime = (value) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' })

onMounted(async () => {
  try {
    attendance.value = await $fetch(endpoint)
  } catch {
    invalid.value = true
  } finally {
    loading.value = false
  }
})

async function answer(value) {
  saving.value = value
  errorMessage.value = ''
  try {
    attendance.value = await $fetch(endpoint, { method: 'POST', body: { answer: value } })
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Votre réponse n’a pas pu être enregistrée.')
  } finally {
    saving.value = ''
  }
}
</script>
