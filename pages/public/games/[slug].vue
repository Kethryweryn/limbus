<template>
  <main v-if="game" class="min-h-screen bg-gray-50 text-gray-900">
    <div class="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <header class="space-y-4 border-b border-gray-200 pb-8">
        <UBadge color="primary" variant="subtle">Publié</UBadge>
        <h1 class="text-4xl font-bold tracking-normal">{{ game.title }}</h1>
        <p class="max-w-4xl text-lg leading-8 text-gray-600 whitespace-pre-line">
          {{ game.description || 'Aucune description renseignée.' }}
        </p>
      </header>

      <section v-if="game.teaserUrl" class="w-full max-w-5xl aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
        <iframe
          :src="embedTeaser(game.teaserUrl)"
          class="h-full w-full"
          frameborder="0"
          allowfullscreen
        />
      </section>

      <section v-if="game.noteIntention" class="max-w-4xl space-y-3">
        <h2 class="text-2xl font-semibold">Note d’intention</h2>
        <p class="text-base leading-7 text-gray-700 whitespace-pre-line">{{ game.noteIntention }}</p>
      </section>
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

const embedTeaser = (url) => {
  if (!url) return ''
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}
</script>
