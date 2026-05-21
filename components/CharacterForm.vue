<template>
    <UCard>
        <template #header>
            {{ mode === 'edit' ? 'Modifier le personnage' : 'Créer un nouveau personnage' }}
        </template>

        <form @submit.prevent="submit" class="space-y-4">
            <UFormField label="Jeu" :error="errors.gameId">
                <USelect v-model="localCharacter.gameId"
                    :items="props.games.map(g => ({ label: g.title, value: g.id }))" value-key="value" placeholder="Choisissez un jeu"
                    required />
            </UFormField>

            <UFormField label="Nom" :error="errors.name">
                <UInput v-model="localCharacter.name" required autofocus />
            </UFormField>

            <UFormField label="Description" :error="errors.description">
                <UTextarea v-model="localCharacter.description" />
            </UFormField>

            <div class="flex gap-2">
                <UButton type="submit" color="primary" :disabled="!localCharacter.name?.trim() || !localCharacter.gameId">
                    {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
                </UButton>
                <UButton @click="$emit('cancel')" color="neutral">
                    Annuler
                </UButton>
            </div>

            <p v-if="serverError" class="text-red-500 text-sm mt-2">{{ serverError }}</p>
        </form>
    </UCard>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
    character: { type: Object, required: true },
    games: { type: Array, required: true },
    mode: { type: String, default: 'create' }
})

const emit = defineEmits(['submit', 'cancel', 'update:character'])

const localCharacter = ref({ ...props.character })
const errors = ref({})
const serverError = ref('')

watch(() => props.character, (newVal) => {
    localCharacter.value = { ...newVal }
    errors.value = {}
    serverError.value = ''
})

function validate() {
    errors.value = {}
    if (!localCharacter.value.name?.trim()) {
        errors.value.name = 'Le nom est requis.'
    }
    if (!localCharacter.value.gameId) {
        errors.value.gameId = 'Le jeu est requis.'
    }
    return Object.keys(errors.value).length === 0
}

async function submit() {
    if (!validate()) return
    try {
        emit('update:character', localCharacter.value)
        await emit('submit')
    } catch (err) {
        serverError.value = err?.data?.message || err?.message || 'Erreur inconnue'
    }
}
</script>
