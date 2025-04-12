<template>
    <div class="p-6">
        <h1 class="text-2xl font-bold mb-4">Personnages</h1>

        <!-- Contexte du jeu sélectionné -->
        <GameContextBar />

        <!-- Barre de recherche -->
        <div class="mb-6 flex gap-4 items-center">
            <UInput v-model="search" placeholder="Rechercher un personnage..." />
        </div>

        <!-- Liste des personnages -->
        <UCard v-for="char in paginatedCharacters" :key="char.id" class="mb-4">
            <template #header>
                <div class="flex justify-between items-center">
                    <NuxtLink :to="`/characters/${char.slug}`" class="font-semibold underline">
                        {{ char.name }}
                    </NuxtLink>
                    <div class="flex gap-2">
                        <UButton size="xs" color="blue" @click="startEdit(char)">Modifier</UButton>
                        <UButton size="xs" color="red" @click="deleteCharacter(char.id)">Supprimer</UButton>
                    </div>
                </div>
            </template>
            <template #default>
                <p>{{ char.description }}</p>
            </template>
        </UCard>

        <!-- Création -->
        <CharacterForm v-model:character="newCharacter" :games="games" mode="create" @submit="createCharacter" />
        <div class="flex justify-center gap-4 mt-6">
            <UButton @click="prevCharPage" :disabled="charPage === 1">← Précédent</UButton>
            <span class="text-sm text-gray-500">Page {{ charPage }} / {{ totalCharPages }}</span>
            <UButton @click="nextCharPage" :disabled="charPage === totalCharPages">Suivant →</UButton>
        </div>


        <!-- Édition -->
        <CharacterForm v-if="editingCharacter" v-model:character="editingCharacter" :games="games" mode="edit"
            @submit="saveEdit" @cancel="editingCharacter = null" />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import GameContextBar from '@/components/GameContextBar.vue'

const characters = ref([])
const search = ref('')
const games = ref([])

const gameStore = useGameStore()
const selectedGame = computed(() => gameStore.currentGame)

const fetchGames = async () => {
    games.value = await $fetch('/api/games')
}

const fetchCharacters = async () => {
    characters.value = await $fetch('/api/characters')
}

onMounted(async () => {
    await Promise.all([fetchGames(), fetchCharacters()])
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

const editingCharacter = ref(null)

const createCharacter = async () => {
    try {
        await $fetch('/api/characters', {
            method: 'POST',
            body: newCharacter.value
        })
        newCharacter.value = {
            name: '',
            description: '',
            gameId: selectedGame.value?.id || ''
        }
        await fetchCharacters()
    } catch (error) {
        console.error('Erreur lors de la création du personnage', error)
    }
}

const startEdit = (char) => {
    editingCharacter.value = { ...char }
}

const saveEdit = async () => {
    if (!editingCharacter.value?.id) return

    try {
        await $fetch(`/api/characters/${editingCharacter.value.id}/put`, {
            method: 'POST',
            body: editingCharacter.value
        })
        editingCharacter.value = null
        await fetchCharacters()
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du personnage', error)
    }
}

const deleteCharacter = async (id) => {
    if (confirm('Supprimer ce personnage ?')) {
        await $fetch(`/api/characters/${id}/delete`, { method: 'POST' })
        await fetchCharacters()
    }
}

const charPage = ref(1)
const itemsPerPage = 5

const paginatedCharacters = computed(() => {
    const start = (charPage.value - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredCharacters.value.slice(start, end)
})

const totalCharPages = computed(() => Math.ceil(filteredCharacters.value.length / itemsPerPage))

const nextCharPage = () => {
    if (charPage.value < totalCharPages.value) charPage.value++
}

const prevCharPage = () => {
    if (charPage.value > 1) charPage.value--
}

</script>