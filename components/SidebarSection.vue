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

<script setup>
defineEmits(['navigate'])

defineProps({
  section: {
    type: Object,
    required: true
  },
  collapsed: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Function,
    required: true
  }
})
</script>
