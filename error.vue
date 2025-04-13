<!-- error.vue -->
<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps({
    error: Object as () => NuxtError
})

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center">
        <h1 class="text-4xl font-bold mb-4">Erreur {{ error.statusCode }}</h1>
        <p class="mb-4">{{ error.statusMessage }}</p>
        <button @click="handleError" class="bg-blue-500 text-white px-4 py-2 rounded">
            Retour à l'accueil
        </button>
    </div>
</template>