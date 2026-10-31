<template>
  <main v-if="game && !game.redirectSlug" class="light min-h-screen bg-gray-50 text-gray-900" style="color-scheme: light;">
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
              {{ link.permanent ? 'S’inscrire au jeu' : `S’inscrire : ${link.name}` }}
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </main>
</template>

<script setup>
definePageMeta({
  layout: false,
  colorMode: 'light'
})

const route = useRoute()
const { data: game, error } = await useFetch(`/api/public/games/${route.params.slug}`)

if (error.value) {
  throw createError({ statusCode: error.value.statusCode || 404, message: 'Jeu non publié' })
}
// Ancienne adresse d'un jeu renommé : redirection permanente vers la nouvelle (US-045)
if (game.value?.redirectSlug) {
  await navigateTo(`/public/games/${game.value.redirectSlug}`, { redirectCode: 301, replace: true })
}

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

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
