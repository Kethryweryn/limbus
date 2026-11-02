<template>
  <section class="space-y-2">
    <div
      class="flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500"
      :class="collapsed ? 'justify-center' : ''"
      :title="collapsed ? section.label : undefined"
    >
      <UIcon v-if="collapsed" :name="section.icon" class="size-4" />
      <span v-else>{{ section.label }}</span>
    </div>

    <div class="space-y-1">
      <SidebarLink
        v-for="link in section.links"
        :key="link.to"
        :item="link"
        :active="isActive(link.to)"
        :collapsed="collapsed"
        @click="$emit('navigate')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { NavSection } from '~/utils/navigation'

defineEmits<{ navigate: [] }>()

withDefaults(defineProps<{ section: NavSection, collapsed?: boolean, isActive: (to: string) => boolean }>(), { collapsed: false })
</script>
