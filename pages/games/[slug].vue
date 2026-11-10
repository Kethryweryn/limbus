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
                    v-if="canDelete"
                    icon="i-heroicons-trash"
                    color="error"
                    variant="soft"
                    @click="showDelete = true"
                >
                    Supprimer définitivement
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
            v-if="isEditing && editableGame"
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
        <GameBequestModal v-model:open="showBequest" :game="game" :owner-name="ownerName" />
        <GameDeleteModal v-if="canDelete" v-model:open="showDelete" :game="game" />
    </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useGameFocus } from '@/composables/useGameFocus'
import { apiErrorMessage, pageLoadError } from '~/utils/apiErrors'
import type { GameDraft } from '~/utils/writingDrafts'
import { gameSheetRead } from '~/utils/offlinePlan'

const route = useRoute()
const slug = String(route.params.slug)
const { data: game, error, refresh } = await useOfflineFetch(gameSheetRead(slug))
const { data: authState } = await useFetch('/api/auth/me')

if (error.value) {
    handleApiAuthError(error.value)
    throw pageLoadError(error.value, 'Jeu introuvable')
}

const { selectGame, clearGame, game: currentGame } = useGameFocus()

const currentUser = computed(() => authState.value?.authenticated ? authState.value.user : null)
const isCurrentGame = computed(() => currentGame?.value?.id === game.value?.id)
const { isEditing, draft: editableGame, startEdit, cancelEdit, closeAfterSave, closeAfterQueued } = useSheetEdit<GameDraft>(() => game.value ? { ...game.value } : null)
const showShares = ref(false)
const showBequest = ref(false)
const showDelete = ref(false)
// Léguer est réservé à la propriétaire, même en mode administrateur (SPEC-002 R1)
const isOwner = computed(() => Boolean(game.value?.ownerId) && game.value?.ownerId === currentUser.value?.id)
const transferProposedToMe = computed(() => Boolean(game.value?.transferToUserId) && game.value?.transferToUserId === currentUser.value?.id)
const ownerName = computed(() => currentUser.value?.name || currentUser.value?.email || '')
const transferring = ref(false)
const actionError = ref('')

// Quitter un jeu partagé (US-059) : ce qu'on y a écrit reste
async function leaveGame() {
    if (!game.value || !currentUser.value) return
    if (!confirm(`Quitter « ${game.value.title} » ? Vous n’y aurez plus accès ; ce que vous y avez écrit reste.`)) return
    try {
        await useApiFetch(`/api/games/${game.value.id}/shares/${currentUser.value.id}`, { method: 'DELETE' })
        // Plus d'accès : le jeu ne reste pas le jeu actif
        if (isCurrentGame.value) clearGame()
        await navigateTo('/games')
    } catch (err) {
        actionError.value = apiErrorMessage(err, 'Erreur inconnue')
    }
}

async function acceptTransfer() {
    if (!game.value) return
    transferring.value = true
    try {
        await useApiFetch(`/api/games/${game.value.id}/transfer/accept`, { method: 'POST' })
        actionError.value = ''
        await refresh()
    } catch (err) {
        actionError.value = apiErrorMessage(err, 'Erreur inconnue')
    } finally {
        transferring.value = false
    }
}

async function refuseTransfer() {
    if (!game.value) return
    transferring.value = true
    try {
        await useApiFetch(`/api/games/${game.value.id}/transfer`, { method: 'DELETE' })
        actionError.value = ''
        await refresh()
    } catch (err) {
        actionError.value = apiErrorMessage(err, 'Erreur inconnue')
    } finally {
        transferring.value = false
    }
}

const canManageShares = computed(() =>
    Boolean(game.value?.id)
    && Boolean(authState.value?.authenticated && (authState.value.adminMode || game.value?.ownerId === authState.value.user.id))
)

// Seul un jeu archivé se supprime, par sa propriétaire ou en mode administrateur (US-207, SPEC-003 R17)
const canDelete = computed(() => canManageShares.value && !game.value?.published)

async function handleGameFormSubmit() {
    if (!editableGame.value?.id) return

    const updatedGame = await useApiFetch(`/api/games/${editableGame.value.id}`, {
        method: 'PUT',
        body: editableGame.value
    })

    if (isOfflineQueued(updatedGame)) return closeAfterQueued(game)

    await closeAfterSave(`/games/${updatedGame.slug}`, refresh)
}

async function setPublicPage(publicPage: boolean) {
    if (!game.value?.id) return

    await useApiFetch(`/api/games/${game.value.id}`, {
        method: 'PUT',
        body: { publicPage }
    })
    game.value = { ...game.value, publicPage }
}
</script>
