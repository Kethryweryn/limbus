<template>
  <div
    class="flex cursor-pointer items-start gap-3 rounded border border-gray-200 px-3 py-2 text-sm"
    :class="disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'"
    @click="toggle"
  >
    <UCheckbox
      v-model="valueProxy"
      :disabled="disabled"
      :aria-label="label"
      class="mt-0.5 shrink-0"
      @click.stop
    />
    <div class="min-w-0">
      <div class="font-medium text-gray-800">{{ label }}</div>
      <div v-if="description" class="mt-0.5 text-xs text-gray-500">{{ description }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue?: boolean, label: string, description?: string, disabled?: boolean }>(), {
  modelValue: false,
  description: '',
  disabled: false
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const valueProxy = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>
