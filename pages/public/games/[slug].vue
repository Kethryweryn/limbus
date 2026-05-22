<template>
  <main v-if="game" class="light min-h-screen bg-gray-50 text-gray-900" style="color-scheme: light;">
    <div class="p-6 max-w-7xl mx-auto">
      <GamePageContent :game="game" />
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
