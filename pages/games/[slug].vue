<template>
    <div v-if="game" class="p-6 max-w-7xl mx-auto space-y-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <UButton to="/games" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
                Jeux
            </UButton>
            <div v-if="!isEditing" class="flex flex-wrap gap-2">
                <UButton
                    v-if="!isCurrentGame"
                    icon="i-heroicons-check-circle"
                    color="success"
                    @click="selectGame({ id: game.id, title: game.title })"
                >
                    Rendre actif
                </UButton>
                <UBadge v-else color="success" variant="subtle" size="lg">
                    Jeu actif
                </UBadge>
                <UButton
                    icon="i-heroicons-pencil-square"
                    color="primary"
                    @click="startEdit"
                >
                    Modifier
                </UButton>
            </div>
        </div>

        <GameForm
            v-if="isEditing"
            v-model:game="editableGame"
            mode="edit"
            @submit="handleGameFormSubmit"
            @cancel="cancelEdit"
        />

        <template v-else>
            <section class="space-y-4 border-b border-gray-200 pb-6">
                <div class="flex flex-wrap gap-2">
                    <UBadge v-if="!game.published" color="neutral" variant="solid">Archivé</UBadge>
                    <UBadge v-if="isCurrentGame" color="success" variant="subtle">Jeu actif</UBadge>
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
