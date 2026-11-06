<template>
  <main v-if="game" class="light min-h-screen bg-gray-50 text-gray-900" style="color-scheme: light;">
    <div class="p-6 max-w-7xl mx-auto">
      <GamePageContent :game="game" :thumbnail-url="`/api/public/games/${game.slug}/teaser-thumbnail`" />

      <!-- Choisis par l'équipe sur la fiche du jeu (US-086) -->
      <div v-if="game.upcomingSessions?.length || game.registrationLinks?.length" class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <UCard v-if="game.upcomingSessions?.length">
          <h2 class="text-lg font-semibold">Prochaines sessions</h2>
          <ul class="mt-3 space-y-1 text-sm text-gray-700">
            <li v-for="(session, index) in game.upcomingSessions" :key="index">
              <span class="font-medium">{{ session.name }}</span>
              <span v-if="session.date"> · {{ formatDate(session.date) }}</span>
              <span v-if="session.location"> · {{ session.location.name }}</span>
            </li>
          </ul>
        </UCard>
        <UCard v-if="game.registrationLinks?.length">
          <h2 class="text-lg font-semibold">S’inscrire</h2>
          <div class="mt-3 flex flex-col items-start gap-2">
            <UButton v-for="link in game.registrationLinks" :key="link.url" :to="link.url" external color="primary" icon="i-heroicons-pencil-square">
              S’inscrire au jeu
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { pageLoadError } from '~/utils/apiErrors'
import { PARIS_TIME_ZONE, formatLongDate } from '~/utils/dates'

definePageMeta({
  layout: false,
  colorMode: 'light'
})

const route = useRoute()
const { data, error } = await useFetch(`/api/public/games/${route.params.slug}`)

if (error.value) {
  throw pageLoadError(error.value, 'Jeu non publié')
}
// Ancienne adresse d'un jeu renommé : redirection permanente vers la nouvelle (US-045)
// La réponse d'un jeu renommé ne porte que sa nouvelle adresse
const game = computed(() => data.value && !('redirectSlug' in data.value) ? data.value : null)
if (data.value && 'redirectSlug' in data.value) {
  await navigateTo(`/public/games/${data.value.redirectSlug}`, { redirectCode: 301, replace: true })
}

const formatDate = (value: string | Date) => formatLongDate(value, PARIS_TIME_ZONE)

useHead(() => ({
  title: game.value ? `${game.value.title} - Limbus` : 'Limbus',
  htmlAttrs: {
    class: 'light',
    'data-color-mode-forced': 'light'
  },
  bodyAttrs: {
    class: 'bg-gray-50 text-gray-900'
  },
  meta: [
    { name: 'color-scheme', content: 'light' },
    { name: 'theme-color', content: '#f9fafb' }
  ]
}))
</script>
