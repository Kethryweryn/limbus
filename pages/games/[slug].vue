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
                <UButton
                    v-if="game.published"
                    :icon="game.publicPage ? 'i-heroicons-eye-slash' : 'i-heroicons-globe-alt'"
                    :color="game.publicPage ? 'neutral' : 'primary'"
                    variant="soft"
                    @click="setPublicPage(!game.publicPage)"
                >
                    {{ game.publicPage ? 'Dépublier' : 'Publier' }}
                </UButton>
                <UButton
                    v-if="game.publicPage"
                    :to="`/public/games/${game.slug}`"
                    icon="i-heroicons-arrow-top-right-on-square"
                    color="neutral"
                    variant="ghost"
                >
                    Page publique
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
            <GamePageContent :game="game">
                <template #badges>
                    <UBadge v-if="!game.published" color="neutral" variant="solid">Archivé</UBadge>
                    <UBadge v-if="isCurrentGame" color="success" variant="subtle">Jeu actif</UBadge>
                    <UBadge v-if="game.publicPage" color="primary" variant="subtle">Publié</UBadge>
                </template>
            </GamePageContent>
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

async function setPublicPage(publicPage) {
    if (!game.value?.id) return

    game.value = await useApiFetch(`/api/games/${game.value.id}`, {
        method: 'PUT',
        body: { publicPage }
    })
}

</script>
