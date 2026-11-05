<template>
  <NuxtLink
    :to="item.to"
    class="flex items-center rounded-md px-3 transition-colors"
    :class="[
      active
        ? 'bg-primary-50 text-primary-700'
        : `${small ? 'text-gray-500' : 'text-gray-700'} hover:bg-gray-100 hover:text-gray-950`,
      small ? 'gap-2 py-1.5 text-xs' : 'gap-3 py-2 text-sm font-medium',
      collapsed ? 'justify-center' : ''
    ]"
    :title="collapsed ? item.label : undefined"
    @click="$emit('click')"
  >
    <UIcon :name="item.icon" class="shrink-0" :class="small ? 'size-4' : 'size-5'" />
    <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { NavLink } from '~/utils/navigation'

defineEmits<{ click: [] }>()

withDefaults(defineProps<{ item: NavLink, active?: boolean, collapsed?: boolean, small?: boolean }>(), { active: false, collapsed: false, small: false })
</script>
