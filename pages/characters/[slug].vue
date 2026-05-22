<template>
    <div class="p-6 max-w-4xl mx-auto space-y-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <UButton to="/characters" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">
                Personnages
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

        <CharacterForm
            v-if="isEditing"
            v-model:character="editableCharacter"
            :games="games || []"
            mode="edit"
            @submit="handleFormSubmit"
            @cancel="cancelEdit"
        />

        <template v-else>
            <h1 class="text-3xl font-bold">{{ character.name }}</h1>

            <div v-if="character.description">
                <h2 class="text-xl font-semibold mb-2">Description</h2>
                <p class="whitespace-pre-line">{{ character.description }}</p>
            </div>

            <div v-if="character.factions?.length">
                <h2 class="text-xl font-semibold mb-2">Factions</h2>
                <ul class="list-disc pl-5">
                    <li v-for="faction in character.factions" :key="faction.id">
                        {{ faction.name }}
                    </li>
                </ul>
            </div>

            <div v-if="character.intrigues?.length">
                <h2 class="text-xl font-semibold mb-2">Intrigues</h2>
                <ul class="list-disc pl-5">
                    <li v-for="intrigue in character.intrigues" :key="intrigue.id">
                        {{ intrigue.title }}
                    </li>
                </ul>
            </div>

            <div v-if="character.documents?.length">
                <h2 class="text-xl font-semibold mb-2">Documents liés</h2>
                <ul class="list-disc pl-5">
                    <li v-for="doc in character.documents" :key="doc.id">
                        {{ doc.title }}
                    </li>
                </ul>
            </div>
        </template>
    </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const slug = route.params.slug
const { data: character, error, refresh } = await useFetch(`/api/characters/slug/${slug}`)
const { data: games } = await useFetch('/api/games')

if (error.value) {
    handleApiAuthError(error.value)
    throw createError({ statusCode: 404, message: 'Personnage introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editableCharacter = ref(character.value ? { ...character.value } : null)

watch(() => route.query.edit, (value) => {
    isEditing.value = value === '1'
    if (isEditing.value && character.value) {
        editableCharacter.value = { ...character.value }
    }
})

function startEdit() {
    editableCharacter.value = { ...character.value }
    isEditing.value = true
    router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
    isEditing.value = false
    editableCharacter.value = character.value ? { ...character.value } : null
    const query = { ...route.query }
    delete query.edit
    router.replace({ path: route.path, query })
}

async function handleFormSubmit() {
    if (!editableCharacter.value?.id) return

    const updatedCharacter = await useApiFetch(`/api/characters/${editableCharacter.value.id}`, {
        method: 'PUT',
        body: editableCharacter.value
    })

    if (updatedCharacter?.slug && updatedCharacter.slug !== route.params.slug) {
        character.value = updatedCharacter
        await router.replace(`/characters/${updatedCharacter.slug}`)
    } else {
        await refresh()
    }

    cancelEdit()
}
</script>
