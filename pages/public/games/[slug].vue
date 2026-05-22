<template>
  <main v-if="game" class="min-h-screen bg-gray-50 text-gray-900">
    <div class="mx-auto max-w-7xl px-6 py-10">
      <GamePageContent :game="game" />
    </div>
  </main>
</template>

<script setup>
definePageMeta({
  layout: false
})

const route = useRoute()
const { data: game, error } = await useFetch(`/api/public/games/${route.params.slug}`)

if (error.value) {
  throw createError({ statusCode: error.value.statusCode || 404, message: 'Jeu non publié' })
}

useHead(() => ({
  title: game.value ? `${game.value.title} - Limbus` : 'Limbus'
}))
</script>
