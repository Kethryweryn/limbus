<template>
  <!-- Mise en page commune des pages légales (US-110) -->
  <div class="min-h-screen bg-gray-50 px-4 py-8">
    <article class="mx-auto max-w-3xl space-y-6 rounded-lg bg-white p-6 shadow-sm sm:p-10">
      <header class="space-y-1">
        <NuxtLink to="/" class="text-sm text-primary hover:underline">Limbus</NuxtLink>
        <h1 class="text-2xl font-bold">{{ title }}</h1>
        <p class="text-sm text-gray-500">Version du {{ TERMS_VERSION_LABEL }}</p>
      </header>
      <div class="legal-text space-y-4 text-sm leading-relaxed text-gray-800">
        <slot />
      </div>
      <LegalLinks />
    </article>
  </div>
</template>

<script setup lang="ts">
import { TERMS_VERSION_LABEL } from '~/utils/legal'

defineProps<{ title: string }>()
</script>

<style scoped>
.legal-text :deep(h2) {
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 1.5rem;
}
.legal-text :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
}
.legal-text :deep(li) {
  margin-top: 0.25rem;
}
.legal-text :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
}
</style>
