<template>
    <div class="p-6 max-w-4xl mx-auto space-y-6">
        <h1 class="text-3xl font-bold">{{ character.name }}</h1>

        <div v-if="character.description">
            <h2 class="text-xl font-semibold mb-2">Description</h2>
            <p>{{ character.description }}</p>
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
    </div>
</template>

<script setup>
const route = useRoute()
const slug = route.params.slug
const { data: character, error } = await useFetch(`/api/characters/${slug}`)

if (error.value) {
    throw createError({ statusCode: 404, message: 'Personnage introuvable' })
}
</script>