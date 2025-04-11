<template>
    <div class="p-6">
        <h1 class="text-2xl font-bold mb-4">Personnages</h1>

        <div class="mb-6 flex gap-4 items-center">
            <UInput v-model="search" placeholder="Rechercher un personnage..." />
        </div>

        <!-- Liste des personnages -->
        <UCard v-for="char in filteredCharacters" :key="char.id" class="mb-4">
            <template #header>
                <div class="flex justify-between items-center">
                    <NuxtLink :to="`/characters/${char.slug}`" class="font-semibold underline">{{ char.name }}
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
        <CharacterForm v-model:character="newCharacter" mode="create" @submit="createCharacter" />

        <!-- Edition -->
        <CharacterForm v-if="editingCharacter" v-model:character="editingCharacter" mode="edit" @submit="saveEdit"
            @cancel="editingCharacter = null" />
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const characters = ref([])
const search = ref('')

const filteredCharacters = computed(() => {
    const term = search.value.toLowerCase()
    return characters.value.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.description?.toLowerCase().includes(term))
    )
})

const fetchCharacters = async () => {
    characters.value = await $fetch('/api/characters')
}
onMounted(fetchCharacters)

const newCharacter = ref({ name: '', description: '' })
const editingCharacter = ref(null)

const createCharacter = async () => {
    try {
        await $fetch('/api/characters', {
            method: 'POST',
            body: newCharacter.value
        })
        newCharacter.value = { name: '', description: '' }
        await fetchCharacters()
    }
    catch (error) {
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
</script>