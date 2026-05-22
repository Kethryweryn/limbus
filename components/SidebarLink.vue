<template>
  <NuxtLink
    :to="item.to"
    class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
    :class="[
      active
        ? 'bg-primary-50 text-primary-700'
        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950',
      collapsed ? 'justify-center' : ''
    ]"
    :title="collapsed ? item.label : undefined"
    @click="$emit('click')"
  >
    <UIcon :name="item.icon" class="size-5 shrink-0" />
    <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
  </NuxtLink>
</template>

<script setup>
defineEmits(['click'])

defineProps({
  item: {
    type: Object,
    required: true
  },
  active: {
    type: Boolean,
    default: false
  },
  collapsed: {
    type: Boolean,
    default: false
  }
})
</script>
