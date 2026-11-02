<template>
  <!-- Pages légales (US-110), liées depuis l'accès, le menu et les formulaires d'inscription -->
  <nav class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500" aria-label="Informations légales">
    <NuxtLink v-for="page in LEGAL_PAGES" :key="page.to" :to="page.to" class="hover:underline">{{ page.label }}</NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { LEGAL_PAGES } from '~/utils/legal'
</script>
