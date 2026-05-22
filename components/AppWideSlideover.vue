<template>
  <USlideover v-model:open="openProxy" :ui="{ content: contentClass }">
    <template #header>
      <div class="flex w-full items-center justify-between gap-3">
        <h2 class="truncate text-base font-semibold">{{ title }}</h2>
        <div class="flex items-center gap-2">
          <UButton
            v-if="fullPageTo"
            :to="fullPageTo"
            icon="i-heroicons-arrows-pointing-out"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="$emit('fullPage')"
          >
            Pleine page
          </UButton>
          <slot name="actions" />
          <UButton
            icon="i-heroicons-x-mark"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Fermer"
            @click="close"
          />
        </div>
      </div>
    </template>

    <template #body>
      <div class="p-6 space-y-6">
        <slot />
      </div>
    </template>
  </USlideover>
</template>

<script setup>
const props = defineProps({
  open: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  fullPageTo: {
    type: [String, Object],
    default: null
  }
})

const emit = defineEmits(['update:open', 'close', 'fullPage'])

const contentClass = 'w-screen max-w-none md:w-[calc(100vw-var(--limbus-sidebar-width,16rem))] md:max-w-none'

const openProxy = computed({
  get: () => props.open,
  set: (value) => {
    emit('update:open', value)
    if (!value) {
      emit('close')
    }
  }
})

function close() {
  emit('update:open', false)
  emit('close')
}
</script>
