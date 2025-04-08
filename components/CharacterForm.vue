<template>
    <UCard>
        <template #header>
            {{ mode === 'edit' ? 'Modifier le personnage' : 'Créer un nouveau personnage' }}
        </template>

        <form @submit.prevent="submit" class="space-y-4">
            <UInput v-model="localCharacter.name" label="Nom" :error="errors.name" required />
            <UTextarea v-model="localCharacter.description" label="Description" />

            <div class="flex gap-2">
                <UButton type="submit" color="blue">
                    {{ mode === 'edit' ? 'Enregistrer' : 'Créer' }}
                </UButton>
                <UButton v-if="mode === 'edit'" @click="$emit('cancel')" color="gray">
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