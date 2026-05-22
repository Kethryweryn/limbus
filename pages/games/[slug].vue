<template>
    <div v-if="game" class="p-6 max-w-4xl mx-auto space-y-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <UButton to="/games" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
                Jeux
            </UButton>
            <UButton
                v-if="!isEditing"
                icon="i-heroicons-pencil-square"
                color="primary"
                @click="startEdit"
            >
                Modifier
            </UButton>
        </div>

        <GameForm
            v-if="isEditing"
            v-model:game="editableGame"
            mode="edit"
            @submit="handleGameFormSubmit"
            @cancel="cancelEdit"
        />

        <template v-else>
        <!-- Carte d'infos -->
        <UCard>
            <template #header>
                Détails du jeu
            </template>

            <p><strong>Titre :</strong> {{ game.title }}</p>

            <UButton :disabled="isCurrentGame" :color="isCurrentGame ? 'neutral' : 'success'"
                @click="selectGame({ id: game.id, title: game.title })" class="mt-4">
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
        </template>
    </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useGameFocus } from '@/composables/useGameFocus'

const route = useRoute()
const router = useRouter()
const slug = route.params.slug
const { data: game, error, refresh } = await useFetch(`/api/games/slug/${slug}`)

if (error.value) {
    handleApiAuthError(error.value)
    throw createError({ statusCode: error.value.statusCode || 404, message: 'Jeu introuvable' })
}

const { selectGame, game: currentGame } = useGameFocus()

const isCurrentGame = computed(() => currentGame?.value?.id === game.value?.id)
const isEditing = ref(route.query.edit === '1')
const editableGame = ref(game.value ? { ...game.value } : null)

watch(() => route.query.edit, (value) => {
    isEditing.value = value === '1'
    if (isEditing.value && game.value) {
        editableGame.value = { ...game.value }
    }
})

function startEdit() {
    editableGame.value = { ...game.value }
    isEditing.value = true
    router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
    isEditing.value = false
    editableGame.value = game.value ? { ...game.value } : null
    const query = { ...route.query }
    delete query.edit
    router.replace({ path: route.path, query })
}

async function handleGameFormSubmit() {
    if (!editableGame.value?.id) return

    const updatedGame = await useApiFetch(`/api/games/${editableGame.value.id}`, {
        method: 'PUT',
        body: editableGame.value
    })

    if (updatedGame?.slug && updatedGame.slug !== route.params.slug) {
        game.value = updatedGame
        await router.replace(`/games/${updatedGame.slug}`)
    } else {
        await refresh()
    }

    cancelEdit()
}

const embedTeaser = (url) => {
    if (!url) return ''
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : url
}
</script>
