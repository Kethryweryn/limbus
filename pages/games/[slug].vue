<template>
    <div class="p-6 max-w-4xl mx-auto space-y-6">
        <h1 class="text-3xl font-bold">{{ game.title }}</h1>

        <div v-if="game.teaserUrl" class="flex justify-center my-6">
            <div class="max-w-3xl">
                <iframe :src="embedTeaser(game.teaserUrl)" class="w-full h-full rounded" frameborder="0"
                    allowfullscreen></iframe>
            </div>
        </div>

        <div>
            <h2 class="text-xl font-semibold mb-2">Description</h2>
            <p>{{ game.description }}</p>
        </div>

        <div v-if="game.noteIntention">
            <h2 class="text-xl font-semibold mb-2">Note d’intention</h2>
            <p>{{ game.noteIntention }}</p>
        </div>
    </div>
</template>

<script setup>
const route = useRoute()
const slug = route.params.slug
const { data: game } = await useFetch(`/api/public/games/${slug}`)

const embedTeaser = (url) => {
    if (!url) return ''
    // Cas YouTube classique
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : url
}
</script>