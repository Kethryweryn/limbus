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
                    v-if="isOwner"
                    icon="i-heroicons-gift"
                    color="neutral"
                    variant="soft"
                    @click="showBequest = true"
                >
                    Léguer une copie
                </UButton>
                <UButton
                    v-if="game.sharedWithMe"
                    icon="i-heroicons-arrow-right-start-on-rectangle"
                    color="error"
                    variant="soft"
                    @click="leaveGame"
                >
                    Quitter ce jeu
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

        <!-- Transfert proposé à la personne connectée (US-060) -->
        <UAlert
            v-if="transferProposedToMe"
            color="info"
            variant="soft"
            title="Transfert proposé"
            description="La propriétaire vous propose de devenir propriétaire de ce jeu. Elle en restera co-organisatrice."
        >
            <template #actions>
                <UButton color="primary" size="sm" :loading="transferring" @click="acceptTransfer">Accepter</UButton>
                <UButton color="neutral" variant="soft" size="sm" :disabled="transferring" @click="refuseTransfer">Refuser</UButton>
            </template>
        </UAlert>
        <UAlert v-if="actionError" color="error" variant="soft" :description="actionError" />

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

        <GameShareModal v-model:open="showShares" :game="game" :is-owner="isOwner" @changed="refresh" />
        <GameBequestModal v-model:open="showBequest" :game="game" :owner-name="authState?.user?.name || authState?.user?.email || ''" />
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

const { selectGame, clearGame, game: currentGame } = useGameFocus()

const isCurrentGame = computed(() => currentGame?.value?.id === game.value?.id)
const isEditing = ref(route.query.edit === '1')
const editableGame = ref(game.value ? { ...game.value } : null)
const showShares = ref(false)
const showBequest = ref(false)
// Léguer est réservé à la propriétaire, même en mode administrateur (SPEC-002 R1)
const isOwner = computed(() => Boolean(game.value?.ownerId) && game.value?.ownerId === authState.value?.user?.id)
const transferProposedToMe = computed(() => Boolean(game.value?.transferToUserId) && game.value?.transferToUserId === authState.value?.user?.id)
const transferring = ref(false)
const actionError = ref('')

// Quitter un jeu partagé (US-059) : ce qu'on y a écrit reste
async function leaveGame() {
    if (!confirm(`Quitter « ${game.value.title} » ? Vous n’y aurez plus accès ; ce que vous y avez écrit reste.`)) return
    try {
        await useApiFetch(`/api/games/${game.value.id}/shares/${authState.value.user.id}`, { method: 'DELETE' })
        // Plus d'accès : le jeu ne reste pas le jeu actif
        if (isCurrentGame.value) clearGame()
        await navigateTo('/games')
    } catch (err) {
        actionError.value = err?.data?.message || err?.message || 'Erreur inconnue'
    }
}

async function acceptTransfer() {
    transferring.value = true
    try {
        await useApiFetch(`/api/games/${game.value.id}/transfer/accept`, { method: 'POST' })
        actionError.value = ''
        await refresh()
    } catch (err) {
        actionError.value = err?.data?.message || err?.message || 'Erreur inconnue'
    } finally {
        transferring.value = false
    }
}

async function refuseTransfer() {
    transferring.value = true
    try {
        await useApiFetch(`/api/games/${game.value.id}/transfer`, { method: 'DELETE' })
        actionError.value = ''
        await refresh()
    } catch (err) {
        actionError.value = err?.data?.message || err?.message || 'Erreur inconnue'
    } finally {
        transferring.value = false
    }
}

const canManageShares = computed(() =>
    Boolean(game.value?.id)
    && (authState.value?.adminMode || game.value?.ownerId === authState.value?.user?.id)
)

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
