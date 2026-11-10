<template>
  <UAlert v-if="result?.error" class="mt-3" color="error" variant="soft" :description="result.text" />
  <p v-else-if="result" class="mt-2 text-sm text-green-700">{{ result.text }}</p>
</template>

<script setup lang="ts">
// Résultat d'un formulaire, affiché sous son bouton (US-216) : une erreur ou une confirmation
import type { FormResult } from '~/composables/useFormResult'

defineProps<{ result: FormResult | null | undefined }>()
</script>
