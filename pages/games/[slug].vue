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
                    v-if="canManageShares"
                    icon="i-heroicons-share"
                    color="neutral"
                    variant="soft"
                    @click="showShares = true"
                >
                    Partager
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

        <UModal v-model:open="showShares" title="Partage du jeu">
            <template #body>
                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                        <USelect
                            v-model="selectedShareUserId"
                            :items="shareableUserOptions"
                            value-key="value"
                            placeholder="Sélectionner un utilisateur"
                        />
                        <UButton color="primary" :disabled="!selectedShareUserId" @click="shareGame">
                            Ajouter
                        </UButton>
                    </div>

                    <div class="space-y-2">
                        <div v-for="share in shares" :key="share.id" class="flex items-center justify-between gap-3 rounded border border-gray-200 p-3">
                            <div>
                                <div class="font-medium">{{ share.user?.name }}</div>
                                <div class="text-sm text-gray-500">{{ share.user?.email }}</div>
                            </div>
                            <UButton color="error" variant="soft" size="xs" @click="removeShare(share.userId)">
                                Retirer
                            </UButton>
                        </div>
                        <p v-if="!shares.length" class="text-sm text-gray-500">Aucun partage pour ce jeu.</p>
                    </div>
                    <p v-if="shareError" class="text-sm text-red-500">{{ shareError }}</p>
                </div>
            </template>
        </UModal>
    </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useGameFocus } from '@/composables/useGameFocus'

const route = useRoute()
const router = useRouter()
const slug = route.params.slug
const { data: game, error, refresh } = await useFetch(`/api/games/slug/${slug}`)
const { data: authState } = await useFetch('/api/auth/me')

if (error.value) {
    handleApiAuthError(error.value)
    throw createError({ statusCode: error.value.statusCode || 404, message: 'Jeu introuvable' })
}

const { selectGame, game: currentGame } = useGameFocus()

const isCurrentGame = computed(() => currentGame?.value?.id === game.value?.id)
const isEditing = ref(route.query.edit === '1')
const editableGame = ref(game.value ? { ...game.value } : null)
const showShares = ref(false)
const users = ref([])
const shares = ref([])
const selectedShareUserId = ref('')
const shareError = ref('')
const canManageShares = computed(() =>
    Boolean(game.value?.id)
    && (authState.value?.adminMode || game.value?.ownerId === authState.value?.user?.id)
)
const shareableUserOptions = computed(() => {
    const sharedIds = new Set(shares.value.map((share) => share.userId))
    return users.value
        .filter((user) => user.id !== game.value?.ownerId && !sharedIds.has(user.id))
        .map((user) => ({
            label: user.email ? `${user.name} - ${user.email}` : user.name,
            value: user.id
        }))
})

watch(showShares, async (value) => {
    if (!value || !canManageShares.value) return
    await refreshShares()
})

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

async function refreshShares() {
    if (!game.value?.id) return

    try {
        const [usersData, sharesData] = await Promise.all([
            useApiFetch('/api/users'),
            useApiFetch(`/api/games/${game.value.id}/shares`)
        ])
        users.value = usersData
        shares.value = sharesData
        selectedShareUserId.value = ''
        shareError.value = ''
    } catch (err) {
        shareError.value = err?.data?.message || err?.message || 'Impossible de charger les partages'
    }
}

async function shareGame() {
    if (!game.value?.id || !selectedShareUserId.value) return

    try {
        await useApiFetch(`/api/games/${game.value.id}/shares`, {
            method: 'POST',
            body: { userId: selectedShareUserId.value }
        })
        await refreshShares()
    } catch (err) {
        shareError.value = err?.data?.message || err?.message || 'Impossible d’ajouter le partage'
    }
}

async function removeShare(userId) {
    if (!game.value?.id || !userId) return

    try {
        await useApiFetch(`/api/games/${game.value.id}/shares/${userId}`, { method: 'DELETE' })
        await refreshShares()
    } catch (err) {
        shareError.value = err?.data?.message || err?.message || 'Impossible de retirer le partage'
    }
}

</script>
