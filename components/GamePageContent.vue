<template>
  <div class="space-y-6">
    <section class="space-y-4 border-b border-gray-200 pb-6">
      <div v-if="$slots.badges" class="flex flex-wrap gap-2">
        <slot name="badges" />
      </div>
      <div class="space-y-3">
        <h1 class="text-4xl font-bold tracking-normal">{{ game.title }}</h1>
        <p class="max-w-4xl text-lg leading-8 text-gray-600 whitespace-pre-line">
          {{ game.description || 'Aucune description renseignée.' }}
        </p>
      </div>
    </section>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
      <section class="xl:col-span-8 space-y-6">
        <div v-if="game.teaserUrl" class="w-full aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          <iframe
            :src="embedTeaser(game.teaserUrl)"
            class="w-full h-full"
            frameborder="0"
            allowfullscreen
          />
        </div>

        <UCard>
          <template #header>
            Description
          </template>
          <p class="text-base leading-7 text-gray-700 whitespace-pre-line">
            {{ game.description || 'Aucune description renseignée.' }}
          </p>
        </UCard>
      </section>

      <aside class="xl:col-span-4 space-y-6">
        <UCard v-if="game.noteIntention">
          <template #header>
            Note d’intention
          </template>
          <p class="text-base leading-7 text-gray-700 whitespace-pre-line">{{ game.noteIntention }}</p>
        </UCard>
      </aside>
    </div>
  </div>
</template>

<script setup>
defineProps({
  game: {
    type: Object,
    required: true
  }
})

const embedTeaser = (url) => {
  if (!url) return ''
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}
</script>
