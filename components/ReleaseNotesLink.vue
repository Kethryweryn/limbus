<template>
  <!-- Lien vers les nouveautés (US-149) : plus petit et séparé du reste du menu -->
  <NuxtLink
    to="/nouveautes"
    class="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
    :class="collapsed ? 'justify-center' : ''"
    :title="collapsed ? 'Nouveautés' : undefined"
    :aria-label="collapsed ? 'Nouveautés' : undefined"
    @click="$emit('click')"
  >
    <UIcon name="i-heroicons-sparkles" class="size-4 shrink-0" />
    <span v-if="!collapsed">Nouveautés</span>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
defineEmits<{ click: [] }>()
</script>
