<template>
  <UApp>
    <main class="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-6">
      <div class="max-w-md text-center space-y-4">
        <img src="/brand/limbus-logo-header.png" alt="Limbus" class="h-14 w-auto mx-auto object-contain">
        <h1 class="text-2xl font-semibold">{{ title }}</h1>
        <p class="text-gray-600">{{ text }}</p>
        <UButton color="primary" @click="goHome">Retour à l’accueil</UButton>
      </div>
    </main>
  </UApp>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

// Refus et absence reçoivent le même message : la page ne dit pas si le jeu ou la fiche existe
const notAvailable = computed(() => [403, 404].includes(props.error.statusCode))
const title = computed(() => notAvailable.value ? 'Page introuvable' : 'Une erreur est survenue')
const text = computed(() => notAvailable.value
  ? 'Cette page n’existe pas, ou vous n’y avez pas accès.'
  : 'Réessayez dans un instant. Si cela continue, revenez à l’accueil.')

useHead({ title: () => `${title.value} - Limbus` })

const goHome = () => clearError({ redirect: '/' })
</script>
