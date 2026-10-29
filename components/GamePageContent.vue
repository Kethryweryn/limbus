<template>
  <div class="space-y-6">
    <section class="space-y-4 border-b border-gray-200 pb-6">
      <div v-if="$slots.badges" class="flex flex-wrap gap-2">
        <slot name="badges" />
      </div>
      <div class="space-y-3">
        <h1 class="text-4xl font-bold tracking-normal">{{ game.title }}</h1>
        <p v-if="creditText" class="text-sm italic text-gray-500" data-testid="game-credit">{{ creditText }}</p>
        <p class="max-w-4xl text-lg leading-8 text-gray-600 whitespace-pre-line">
          {{ game.description || 'Aucune description renseignée.' }}
        </p>
      </div>
    </section>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
      <section class="xl:col-span-8 space-y-6">
        <div v-if="teaserEmbedUrl" class="w-full aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          <iframe
            v-if="teaserPlaying"
            :src="`${teaserEmbedUrl}?autoplay=1`"
            class="w-full h-full"
            frameborder="0"
            allow="autoplay; fullscreen"
            allowfullscreen
          />
          <!-- Rien n'est chargé depuis YouTube avant le clic (US-046) : la vignette est servie par Limbus -->
          <button
            v-else
            type="button"
            class="relative w-full h-full grid place-items-center bg-gradient-to-br from-gray-200 to-gray-400"
            @click="teaserPlaying = true"
          >
            <img
              v-if="thumbnailUrl && !thumbnailFailed"
              :src="thumbnailUrl"
              alt=""
              class="absolute inset-0 w-full h-full object-cover"
              @error="thumbnailFailed = true"
            >
            <span class="relative flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-white">
              <UIcon name="i-heroicons-play" class="size-5" />
              Lire la vidéo (YouTube)
            </span>
          </button>
        </div>
        <UButton
          v-else-if="teaserLinkUrl"
          :to="teaserLinkUrl"
          target="_blank"
          rel="noopener noreferrer"
          icon="i-heroicons-play"
          color="neutral"
          variant="outline"
        >
          Voir le teaser
        </UButton>

        <UCard variant="outline" class="bg-white text-gray-900">
          <template #header>
            Description
          </template>
          <p class="text-base leading-7 text-gray-700 whitespace-pre-line">
            {{ game.description || 'Aucune description renseignée.' }}
          </p>
        </UCard>
      </section>

      <aside class="xl:col-span-4 space-y-6">
        <UCard v-if="game.noteIntention" variant="outline" class="bg-white text-gray-900">
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
import { isHttpUrl, youtubeEmbedUrl } from '~/utils/urls'
import { gameCreditText } from '~/utils/games'

const props = defineProps({
  game: {
    type: Object,
    required: true
  },
  // Vignette du teaser servie par Limbus (page publique) ; sans elle, un fond neutre
  thumbnailUrl: {
    type: String,
    default: ''
  }
})

const teaserPlaying = ref(false)
const thumbnailFailed = ref(false)

const creditText = computed(() => gameCreditText(props.game))
const teaserEmbedUrl = computed(() => youtubeEmbedUrl(props.game.teaserUrl))
const teaserLinkUrl = computed(() => props.game.teaserUrl && isHttpUrl(props.game.teaserUrl) ? props.game.teaserUrl : null)
</script>
