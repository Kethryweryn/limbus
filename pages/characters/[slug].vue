<template>
    <div class="p-6 max-w-7xl mx-auto space-y-6">
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
            :factions="factions || []"
            mode="edit"
            @submit="handleFormSubmit"
            @cancel="cancelEdit"
        />

        <template v-else>
            <h1 class="text-3xl font-bold">{{ character.name }}</h1>

            <div v-if="character.factions?.length" class="flex flex-wrap gap-2">
                <UButton
                    v-for="faction in character.factions"
                    :key="faction.id"
                    :to="`/factions/${faction.slug}`"
                    color="primary"
                    variant="soft"
                    size="sm"
                    icon="i-heroicons-user-group"
                >
                    {{ faction.name }}
                </UButton>
            </div>

            <section v-if="character.pitch" class="space-y-2 rounded-lg border border-gray-200 bg-white p-5">
                <h2 class="text-xl font-semibold">Pitch</h2>
                <p class="whitespace-pre-line leading-7 text-gray-700">{{ character.pitch }}</p>
            </section>

            <section
                v-if="character.background || character.backgroundDocumentUrl"
                class="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
            >
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 class="text-xl font-semibold">Background</h2>
                    <UButton
                        v-if="character.backgroundDocumentUrl"
                        :to="character.backgroundDocumentUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        icon="i-heroicons-arrow-top-right-on-square"
                        color="neutral"
                        variant="soft"
                    >
                        Ouvrir le document
                    </UButton>
                </div>
                <p v-if="character.background" class="whitespace-pre-line leading-7 text-gray-700">
                    {{ character.background }}
                </p>
            </section>

            <section v-if="character.costumeIndications" class="space-y-2 rounded-lg border border-gray-200 bg-white p-5">
                <h2 class="text-xl font-semibold">Indications costumes</h2>
                <p class="whitespace-pre-line leading-7 text-gray-700">{{ character.costumeIndications }}</p>
            </section>

            <div
                v-if="!character.pitch && !character.background && !character.backgroundDocumentUrl && !character.costumeIndications"
                class="rounded-lg border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-500"
            >
                Aucun contenu renseigné pour ce personnage.
            </div>

            <div v-if="character.intrigues?.length">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
                    <h2 class="text-xl font-semibold">Intrigues</h2>
                    <UButton
                        color="neutral"
                        variant="soft"
                        size="sm"
                        icon="i-heroicons-pencil-square"
                        @click="showIntrigueModal = true"
                    >
                        Modifier les intrigues
                    </UButton>
                </div>
                <div class="flex flex-wrap gap-2">
                    <UButton
                        v-for="intrigue in character.intrigues"
                        :key="intrigue.id"
                        :to="`/intrigues/${intrigue.slug}`"
                        color="neutral"
                        variant="soft"
                        size="sm"
                        icon="i-heroicons-book-open"
                    >
                        {{ intrigue.name }}
                    </UButton>
                </div>
            </div>
            <div v-else-if="availableIntrigues.length" class="rounded-lg border border-dashed border-gray-300 bg-white p-5">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p class="text-sm text-gray-500">Aucune intrigue associée.</p>
                    <UButton
                        color="neutral"
                        variant="soft"
                        size="sm"
                        icon="i-heroicons-plus"
                        @click="showIntrigueModal = true"
                    >
                        Ajouter des intrigues
                    </UButton>
                </div>
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

        <UModal v-model:open="showIntrigueModal" title="Intrigues du personnage">
            <template #body>
                <form class="space-y-4" @submit.prevent="saveCharacterIntrigues">
                    <UFormField label="Intrigues">
                        <USelectMenu
                            v-model="selectedIntrigueIds"
                            :items="intrigueOptions"
                            value-key="value"
                            multiple
                            placeholder="Associer des intrigues"
                            class="w-full"
                        />
                    </UFormField>
                    <div class="flex flex-wrap gap-2">
                        <UButton type="submit" color="primary">
                            Enregistrer
                        </UButton>
                        <UButton type="button" color="neutral" variant="soft" @click="showIntrigueModal = false">
                            Annuler
                        </UButton>
                    </div>
                </form>
            </template>
        </UModal>
    </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const slug = route.params.slug
const { data: character, error, refresh } = await useFetch(`/api/characters/slug/${slug}`)
const { data: games } = await useFetch('/api/games')
const { data: factions } = await useFetch('/api/factions')
const { data: intrigues, refresh: refreshIntrigues } = await useFetch('/api/intrigues')

if (error.value) {
    handleApiAuthError(error.value)
    throw createError({ statusCode: 404, message: 'Personnage introuvable' })
}

const isEditing = ref(route.query.edit === '1')
const editableCharacter = ref(character.value ? characterFormPayload(character.value) : null)
const showIntrigueModal = ref(false)
const selectedIntrigueIds = ref(character.value?.intrigues?.map((intrigue) => intrigue.id) || [])

const availableIntrigues = computed(() =>
    (intrigues.value || [])
        .filter((intrigue) => intrigue.gameId === character.value?.gameId)
        .sort((a, b) => a.name.localeCompare(b.name))
)

const intrigueOptions = computed(() =>
    availableIntrigues.value.map((intrigue) => ({
        label: intrigue.name,
        value: intrigue.id
    }))
)

watch(() => route.query.edit, (value) => {
    isEditing.value = value === '1'
    if (isEditing.value && character.value) {
        editableCharacter.value = characterFormPayload(character.value)
    }
})

watch(() => character.value?.intrigues, (value) => {
    selectedIntrigueIds.value = value?.map((intrigue) => intrigue.id) || []
})

function characterFormPayload(value) {
    return {
        ...value,
        factionIds: value.factions?.map((faction) => faction.id) || []
    }
}

function startEdit() {
    editableCharacter.value = characterFormPayload(character.value)
    isEditing.value = true
    router.replace({ path: route.path, query: { ...route.query, edit: '1' } })
}

function cancelEdit() {
    isEditing.value = false
    editableCharacter.value = character.value ? characterFormPayload(character.value) : null
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

async function saveCharacterIntrigues() {
    if (!character.value?.id) return

    const currentIds = new Set(character.value.intrigues?.map((intrigue) => intrigue.id) || [])
    const nextIds = new Set(selectedIntrigueIds.value || [])
    const relevantIntrigues = availableIntrigues.value.filter((intrigue) =>
        currentIds.has(intrigue.id) || nextIds.has(intrigue.id)
    )

    await Promise.all(relevantIntrigues.map((intrigue) => {
        const characterIds = new Set(intrigue.characters?.map((item) => item.id) || [])

        if (nextIds.has(intrigue.id)) {
            characterIds.add(character.value.id)
        } else {
            characterIds.delete(character.value.id)
        }

        return useApiFetch(`/api/intrigues/${intrigue.id}`, {
            method: 'PUT',
            body: {
                name: intrigue.name,
                pitch: intrigue.pitch,
                description: intrigue.description,
                level: intrigue.level,
                gameId: intrigue.gameId,
                characterIds: Array.from(characterIds),
                factionIds: intrigue.factions?.map((faction) => faction.id) || [],
                published: intrigue.published
            }
        })
    }))

    showIntrigueModal.value = false
    await Promise.all([refresh(), refreshIntrigues()])
}
</script>
