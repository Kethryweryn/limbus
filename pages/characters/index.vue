<template>
    <div class="p-6">
        <h1 class="text-2xl font-bold mb-4">Personnages</h1>

        <!-- Contexte du jeu sélectionné -->
        <GameContextBar />

        <div class="mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div class="flex flex-col md:flex-row gap-4 flex-1">
                <UInput v-model="search" placeholder="Rechercher un personnage..." class="w-full md:w-96" />
                <USelect
                    v-if="!selectedGame"
                    v-model="gameFilter"
                    :items="gameFilterOptions"
                    value-key="value"
                    class="w-full md:w-64"
                />
                <AppCheckboxRow v-if="!selectedGame" v-model="showArchived" label="Afficher les archives" />
                <USelect
                    v-model="sortOption"
                    :items="sortOptions"
                    value-key="value"
                    class="w-full md:w-64"
                />
            </div>
            <UButton color="primary" @click="openCreateSlideover">Créer un personnage</UButton>
        </div>

        <!-- Liste des personnages -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <UCard
                v-for="char in paginatedCharacters"
                :key="char.id"
                class="cursor-pointer transition-shadow hover:shadow-md"
                role="link"
                tabindex="0"
                @click="openCharacterPage(char)"
                @keydown.enter="openCharacterPage(char)"
            >
                <template #header>
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 space-y-2">
                            <h2 class="text-lg font-semibold leading-tight">
                                {{ char.name }}
                            </h2>
                            <div class="flex flex-wrap gap-1">
                                <UBadge color="neutral" variant="subtle" size="xs" class="max-w-full truncate">
                                    {{ char.game?.title || 'Jeu inconnu' }}
                                </UBadge>
                                <UBadge color="warning" variant="subtle" size="xs">
                                    {{ char.type === CHARACTER_TYPES.pnj ? 'PNJ' : 'PJ' }}
                                </UBadge>
                                <UBadge
                                    v-for="faction in char.factions || []"
                                    :key="faction.id"
                                    color="primary"
                                    variant="subtle"
                                    size="xs"
                                    class="max-w-40 truncate"
                                >
                                    {{ faction.name }}
                                </UBadge>
                                <UBadge v-if="isInArchivedGame(char)" color="neutral" variant="solid" size="xs">
                                    Archivé
                                </UBadge>
                            </div>
                        </div>
                    </div>
                </template>

                <div class="space-y-4">
                    <p class="text-sm leading-6 text-gray-600 line-clamp-5">
                        {{ char.pitch || 'Aucun pitch renseigné.' }}
                    </p>

                    <div class="flex flex-wrap gap-1">
                        <UBadge
                            v-for="level in intrigueLevelsSummary(char)"
                            :key="level.value"
                            :color="level.count ? level.color : 'neutral'"
                            :variant="level.count ? 'subtle' : 'outline'"
                            size="xs"
                        >
                            {{ level.shortLabel }} {{ level.count }}
                        </UBadge>
                    </div>

                    <div class="flex flex-wrap gap-2 pt-1">
                        <UButton
                            icon="i-heroicons-pencil-square"
                            size="xs"
                            color="primary"
                            @click.stop="startEdit(char)"
                        >
                            Modifier
                        </UButton>
                        <UButton
                            icon="i-heroicons-trash"
                            size="xs"
                            color="error"
                            variant="soft"
                            @click.stop="deleteCharacter(char.id)"
                        >
                            Supprimer
                        </UButton>
                    </div>
                </div>
            </UCard>
        </div>

        <div class="flex items-center justify-center gap-4 mt-6">
            <UButton :disabled="charPage === 1" @click="prevCharPage">← Précédent</UButton>
            <span class="inline-flex items-center text-sm text-gray-500">Page {{ charPage }} / {{ totalCharPages }}</span>
            <UButton :disabled="charPage === totalCharPages" @click="nextCharPage">Suivant →</UButton>
        </div>




    <!-- Slideover pour création et édition -->
    <AppWideSlideover
        v-model:open="showSlideover"
        :title="formMode === 'edit' ? 'Modifier le personnage' : 'Créer un personnage'"
        :full-page-to="formMode === 'edit' && activeFormCharacter?.slug ? `/characters/${activeFormCharacter.slug}?edit=1` : null"
        @close="closeSlideover"
        @full-page="showSlideover = false"
    >
        <CharacterForm
            v-if="activeFormCharacter"
            v-model:character="activeFormCharacter"
            :games="games"
            :factions="factions"
            :mode="formMode"
            @submit="handleFormSubmit"
            @cancel="closeSlideover"
        />
    </AppWideSlideover>
    </div>
</template>

<script setup lang="ts">
import { DELETE_CONFIRMATIONS } from '~/utils/deleteConfirmations'
import { confirmedDelete } from '~/composables/useConfirmedDelete'
import { fetchOfflineList, useConnectionRefresh } from '~/composables/useOfflineList'
import { isInArchivedGame, isVisibleContent } from '~/utils/games'
import { ref, computed, onMounted, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { CHARACTER_TYPES, INTRIGUE_LEVELS } from '~/utils/domain'
import type { ApiResponse } from '~/composables/useApiFetch'
import type { CharacterDraft } from '~/utils/writingDrafts'
import type { UiColor } from '~/utils/ui'

type CharacterItem = ApiResponse<'/api/characters'>[number]
type GameItem = ApiResponse<'/api/games'>[number]
type FactionItem = ApiResponse<'/api/factions'>[number]

const characters = ref<CharacterItem[]>([])
const search = ref('')
const sortOption = ref('updated-desc')
const gameFilter = ref('all')
const showArchived = ref(false)
const games = ref<GameItem[]>([])
const factions = ref<FactionItem[]>([])
const router = useRouter()

const gameStore = useGameStore()
const selectedGame = computed(() => gameStore.currentGame)

const sortOptions = [
    { label: 'Dernière modification', value: 'updated-desc' },
    { label: 'Nom A-Z', value: 'name-asc' },
    { label: 'Nom Z-A', value: 'name-desc' }
]

const intrigueLevelCards: Array<{ value: string, shortLabel: string, color: UiColor }> = [
    { value: INTRIGUE_LEVELS.mainStory, shortLabel: 'Scénario', color: 'primary' },
    { value: INTRIGUE_LEVELS.mainCharacter, shortLabel: 'Perso', color: 'primary' },
    { value: INTRIGUE_LEVELS.major, shortLabel: 'Majeure', color: 'warning' },
    { value: INTRIGUE_LEVELS.minor, shortLabel: 'Mineure', color: 'neutral' }
]

const intrigueLevelsSummary = (character: CharacterItem) => {
    const counts = (character.intrigues || []).reduce<Record<string, number>>((acc, intrigue) => {
        acc[intrigue.level] = (acc[intrigue.level] || 0) + 1
        return acc
    }, {})

    return intrigueLevelCards.map((level) => ({
        ...level,
        count: counts[level.value] || 0
    }))
}

const gameFilterOptions = computed(() => [
    { label: 'Tous les jeux', value: 'all' },
    ...games.value.map((game) => ({ label: game.title, value: game.id }))
])

const fetchGames = async () => {
    games.value = await fetchOfflineList('games', '/api/games')
}

const fetchCharacters = async () => {
    characters.value = await fetchOfflineList('characters', '/api/characters')
}

const fetchFactions = async () => {
    factions.value = await fetchOfflineList('factions', '/api/factions')
}

const refreshData = async () => {
    await Promise.all([fetchGames(), fetchCharacters(), fetchFactions()])
}

useConnectionRefresh(refreshData)

onMounted(async () => {
    await refreshData()
})

// 🧠 Filtrage par jeu actif et recherche
const filteredCharacters = computed(() => {
    const term = search.value.toLowerCase()
    const gameId = selectedGame.value?.id || (gameFilter.value === 'all' ? '' : gameFilter.value)

    const result = characters.value
        .filter(c => !gameId || c.gameId === gameId)
        .filter((c) => isVisibleContent(c, gameId, showArchived.value))
        .filter(c =>
            c.name.toLowerCase().includes(term) ||
            (c.pitch?.toLowerCase().includes(term)) ||
            (c.background?.toLowerCase().includes(term)) ||
            (c.costumeIndications?.toLowerCase().includes(term)) ||
            (c.factions || []).some((faction) => faction.name?.toLowerCase().includes(term))
        )

    switch (sortOption.value) {
        case 'name-asc':
            result.sort((a, b) => a.name.localeCompare(b.name))
            break
        case 'name-desc':
            result.sort((a, b) => b.name.localeCompare(a.name))
            break
        default:
            result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return result
})

const charPage = ref(1)
const itemsPerPage = 6

const paginatedCharacters = computed(() => {
    const start = (charPage.value - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredCharacters.value.slice(start, end)
})

const totalCharPages = computed(() =>
    Math.max(1, Math.ceil(filteredCharacters.value.length / itemsPerPage))
)

const nextCharPage = () => {
    if (charPage.value < totalCharPages.value) charPage.value++
}

const prevCharPage = () => {
    if (charPage.value > 1) charPage.value--
}


// Quand on fait une recherche on revient à la page 1 de la pagination
watch([search, sortOption, gameFilter, filteredCharacters], () => {
    charPage.value = 1
})

const showSlideover = ref(false)
const activeFormCharacter = ref<CharacterDraft | null>(null)
const formMode = ref<'create' | 'edit'>('create')

function openCreateSlideover() {
    activeFormCharacter.value = {
        name: '',
        pitch: '',
        type: CHARACTER_TYPES.pj,
        background: '',
        backgroundDocumentUrl: '',
        sheetReadyToSend: false,
        costumeIndications: '',
        excludeFromTrombinoscope: false,
        trombinoscopeFaceHidden: false,
        trombinoscopePhotoUrl: '',
        trombinoscopeNote: '',
        trombinoscopeDisplayName: '',
        factionIds: [],
        gameId: selectedGame.value?.id || ''
    }
    formMode.value = 'create'
    showSlideover.value = true
}

function startEdit(char: CharacterItem) {
    activeFormCharacter.value = {
        ...char,
        factionIds: char.factions?.map((faction) => faction.id) || []
    }
    formMode.value = 'edit'
    showSlideover.value = true
}

function closeSlideover() {
    activeFormCharacter.value = null
    showSlideover.value = false
}

function openCharacterPage(char: CharacterItem) {
    if (!char?.slug) return
    router.push(`/characters/${char.slug}`)
}

async function handleFormSubmit() {
    if (!activeFormCharacter.value) return
    try {
        if (formMode.value === 'create') {
            await useApiFetch('/api/characters', {
                method: 'POST',
                body: activeFormCharacter.value
            })
        } else if (formMode.value === 'edit') {
            await useApiFetch(`/api/characters/${activeFormCharacter.value.id}`, {
                method: 'PUT',
                body: activeFormCharacter.value
            })
        }
        closeSlideover()
        await Promise.all([fetchCharacters(), fetchFactions()])
    } catch (error) {
        console.error('Erreur lors de la soumission du formulaire', error)
    }
}

const deleteCharacter = async (id: string) => {
    if (await confirmedDelete(`/api/characters/${id}`, DELETE_CONFIRMATIONS.character)) {
        await Promise.all([fetchCharacters(), fetchFactions()])
    }
}

</script>
