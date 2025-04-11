<template>
    <div class="p-6 max-w-4xl mx-auto space-y-6">

        <!-- Carte d'infos -->
        <UCard>
            <template #header>
                Détails du jeu
            </template>

            <p><strong>Titre :</strong> {{ game.title }}</p>
            <p><strong>ID :</strong> {{ game.id }}</p>

            <UButton :disabled="isCurrentGame" :color="isCurrentGame ? 'gray' : 'green'" @click="selectGame(game)"
                class="mt-4">
                {{ isCurrentGame ? 'Jeu déjà actif' : 'Définir comme jeu actif' }}
            </UButton>
        </UCard>

        <!-- Titre -->
        <h1 class="text-3xl font-bold">{{ game.title }}</h1>

        <!-- Teaser -->
        <div v-if="game.teaserUrl" class="flex justify-center my-6">
            <div class="w-full max-w-lg aspect-video">
                <iframe :src="embedTeaser(game.teaserUrl)" class="w-full h-full rounded" frameborder="0"
                    allowfullscreen></iframe>
            </div>
        </div>

        <!-- Description -->
        <div>
            <h2 class="text-xl font-semibold mb-2">Description</h2>
            <p>{{ game.description }}</p>
        </div>

        <!-- Note d’intention -->
        <div v-if="game.noteIntention">
            <h2 class="text-xl font-semibold mb-2">Note d’intention</h2>
            <p>{{ game.noteIntention }}</p>
        </div>

    </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useGameFocus } from '@/composables/useGameFocus'

const route = useRoute()
const slug = route.params.slug
const { data: game } = await useFetch(`/api/games/${slug}`)

const { selectGame, game: currentGame } = useGameFocus()

const isCurrentGame = computed(() => currentGame?.value?.id === game.value?.id)

const embedTeaser = (url) => {
    if (!url) return ''
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : url
}
</script>