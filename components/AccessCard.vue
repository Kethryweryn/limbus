<script setup lang="ts">
// Cadre des pages d'accès sans connexion : inscription, confirmation, mot de passe (EPIC-013)
defineProps<{ title: string, subtitle?: string }>()
</script>

<template>
  <div class="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 flex items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="space-y-4">
          <img
            src="/brand/limbus-logo-header.png"
            alt="Limbus"
            class="mx-auto h-20 w-full max-w-xs object-contain"
          >
          <h1 class="text-2xl font-semibold">{{ title }}</h1>
          <p v-if="subtitle" class="text-sm text-gray-500">{{ subtitle }}</p>
        </div>
      </template>
      <slot />
      <div class="mt-4 text-sm">
        <NuxtLink to="/" class="text-primary hover:underline">Retour à la connexion</NuxtLink>
      </div>
    </UCard>
  </div>
</template>
