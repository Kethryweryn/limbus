<template>
  <main class="light min-h-screen bg-gray-50 px-4 py-8 text-gray-900" style="color-scheme: light;">
    <div class="mx-auto max-w-2xl space-y-6">
      <RegistrationResponse :endpoint="endpoint" :availability-request="availabilityRequest" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { AVAILABILITY_ANSWER_PARAMS } from '~/utils/registrations'

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
// Lien d'une demande de disponibilités (R11) : ouvrir la page ne répond pas
const availabilityRequest = computed(() => {
  const { session, reponse } = route.query
  const known = reponse === AVAILABILITY_ANSWER_PARAMS.available || reponse === AVAILABILITY_ANSWER_PARAMS.unavailable
  return typeof session === 'string' && known ? { sessionId: session, available: reponse === AVAILABILITY_ANSWER_PARAMS.available } : null
})
</script>
