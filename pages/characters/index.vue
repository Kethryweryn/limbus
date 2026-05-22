<template>
    <div class="p-6">
        <h1 class="text-2xl font-bold mb-4">Personnages</h1>

        <!-- Contexte du jeu sélectionné -->
        <GameContextBar />

        <!-- Barre de recherche -->
        <div class="mb-6 flex flex-wrap gap-4 items-center justify-between">
            <UInput v-model="search" placeholder="Rechercher un personnage..." class="w-full md:w-96" />
            <UButton v-if="!isOffline" @click="openCreateSlideover" color="primary">Créer un personnage</UButton>
        </div>

        <!-- Liste des personnages -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <UCard v-for="char in paginatedCharacters" :key="char.id">
                <template #header>
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 space-y-2">
                            <NuxtLink :to="`/characters/${char.slug}`" class="block text-lg font-semibold leading-tight hover:underline">
                                {{ char.name }}
                            </NuxtLink>
                            <div class="flex flex-wrap gap-1">
                                <UBadge color="neutral" variant="subtle" size="xs" class="max-w-full truncate">
                                    {{ char.game?.title || 'Jeu inconnu' }}
                                </UBadge>
                                <UBadge v-if="!char.published" color="neutral" variant="solid" size="xs">
                                    Archivé
                                </UBadge>
                            </div>
                        </div>
                    </div>
                </template>

                <div class="space-y-4">
                    <p class="text-sm leading-6 text-gray-600 line-clamp-5">
                        {{ char.description || 'Aucune description renseignée.' }}
                    </p>

                    <div v-if="!isOffline" class="flex flex-wrap gap-2 pt-1">
                        <UButton
                            icon="i-heroicons-pencil-square"
                            size="xs"
                            color="primary"
                            @click="startEdit(char)"
                        >
                            Modifier
                        </UButton>
                        <UButton
                            icon="i-heroicons-trash"
                            size="xs"
                            color="error"
                            variant="soft"
                            @click="deleteCharacter(char.id)"
                        >
                            Supprimer
                        </UButton>
                    </div>
                </div>
            </UCard>
        </div>

        <div class="flex justify-center gap-4 mt-6">
            <UButton @click="prevCharPage" :disabled="charPage === 1">← Précédent</UButton>
            <span class="text-sm text-gray-500">Page {{ charPage }} / {{ totalCharPages }}</span>
            <UButton @click="nextCharPage" :disabled="charPage === totalCharPages">Suivant →</UButton>
        </div>


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
            :mode="formMode"
            @submit="handleFormSubmit"
            @cancel="closeSlideover"
        />
    </AppWideSlideover>

</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'
//import GameContextBar from '@/components/GameContextBar.vue'

const characters = ref([])
const search = ref('')
const games = ref([])

const gameStore = useGameStore()
const selectedGame = computed(() => gameStore.currentGame)
const isOffline = ref(false)

const fetchGames = async () => {
    if (isOfflineMode()) {
        games.value = await getFromStore('games', 'list') || []
        return
    }

    const data = await useApiFetch('/api/games')
    games.value = data
    await saveToStore('games', 'list', data)
}

const fetchCharacters = async () => {
    if (isOfflineMode()) {
        characters.value = await getFromStore('characters', 'list') || []
        return
    }

    const data = await useApiFetch('/api/characters')
    characters.value = data
    await saveToStore('characters', 'list', data)
}

const refreshData = async () => {
    await Promise.all([fetchGames(), fetchCharacters()])
}

const updateStatus = () => {
    const wasOffline = isOffline.value
    isOffline.value = isOfflineMode()

    if (wasOffline && !isOffline.value) {
        refreshData()
    }
    if (!wasOffline && isOffline.value) {
        refreshData()
    }
}

onMounted(async () => {
    updateStatus()
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    window.addEventListener('limbus:connection-change', updateStatus)
    await refreshData()
})

onUnmounted(() => {
    window.removeEventListener('online', updateStatus)
    window.removeEventListener('offline', updateStatus)
    window.removeEventListener('limbus:connection-change', updateStatus)
})

// 🧠 Filtrage par jeu actif et recherche
const filteredCharacters = computed(() => {
    const term = search.value.toLowerCase()
    const gameId = selectedGame.value?.id

    return characters.value
        .filter(c => !gameId || c.gameId === gameId)
        .filter(c =>
            c.name.toLowerCase().includes(term) ||
            (c.description?.toLowerCase().includes(term))
        )
})

const charPage = ref(1)
const itemsPerPage = 5

const paginatedCharacters = computed(() => {
    const start = (charPage.value - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredCharacters.value.slice(start, end)
})

const totalCharPages = computed(() =>
    Math.ceil(filteredCharacters.value.length / itemsPerPage)
)

const nextCharPage = () => {
    if (charPage.value < totalCharPages.value) charPage.value++
}

const prevCharPage = () => {
    if (charPage.value > 1) charPage.value--
}


// 🧱 Création
const newCharacter = ref({
    name: '',
    description: '',
    gameId: selectedGame.value?.id || ''
})

// Met à jour le jeu assigné au personnage si le jeu actif change
watch(() => selectedGame.value?.id, (newId) => {
    newCharacter.value.gameId = newId || ''
})

// Quand on fait une recherche on revient à la page 1 de la pagination
watch([search, filteredCharacters], () => {
    charPage.value = 1
})

const showSlideover = ref(false)
const activeFormCharacter = ref(null)
const formMode = ref('create')

function openCreateSlideover() {
    activeFormCharacter.value = { name: '', description: '', gameId: selectedGame.value?.id || '' }
    formMode.value = 'create'
    showSlideover.value = true
}

function startEdit(char) {
    activeFormCharacter.value = { ...char }
    formMode.value = 'edit'
    showSlideover.value = true
}

function closeSlideover() {
    activeFormCharacter.value = null
    showSlideover.value = false
}

async function handleFormSubmit() {
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
        await fetchCharacters()
    } catch (error) {
        console.error('Erreur lors de la soumission du formulaire', error)
    }
}

const deleteCharacter = async (id) => {
    if (confirm('Supprimer ce personnage ?')) {
        await useApiFetch(`/api/characters/${id}`, { method: 'DELETE' })
        await fetchCharacters()
    }
}

</script>
