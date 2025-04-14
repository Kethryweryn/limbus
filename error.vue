<script setup lang="ts">
import type { NuxtError } from '#app'

// props.error contient un objet potentiellement non sérialisable
const props = defineProps<{
    error: Partial<NuxtError> & Record<string, any>
}>()

// On extrait manuellement les champs safe pour éviter le bug de serialization
const safeError = computed(() => {
    return {
        statusCode: props.error?.statusCode ?? 500,
        statusMessage: typeof props.error?.statusMessage === 'string' ? props.error.statusMessage : '',
        message: typeof props.error?.message === 'string' ? props.error.message : 'Une erreur est survenue.',
    }
})

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center text-center p-6">
        <h1 class="text-4xl font-bold mb-4">Erreur {{ safeError.statusCode }}</h1>
        <p class="mb-4">{{ safeError.statusMessage || safeError.message }}</p>
        <button @click="handleError" class="bg-blue-500 text-white px-4 py-2 rounded">
            Retour à l'accueil
        </button>
    </div>
</template>