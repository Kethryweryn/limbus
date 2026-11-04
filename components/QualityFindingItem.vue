<template>
  <li class="rounded border border-gray-200 px-3 py-2 text-sm">
    <div class="flex flex-wrap items-start gap-2">
      <UBadge :color="QUALITY_LEVELS[level].color" variant="subtle" size="sm">{{ QUALITY_LEVELS[level].label }}</UBadge>
      <span class="min-w-0 flex-1 text-gray-800">{{ sentence }}</span>
    </div>
    <p v-if="todo" class="mt-1 text-gray-600">{{ todo }}</p>
    <details class="mt-1 text-xs text-gray-500">
      <summary class="cursor-pointer">Détail</summary>
      <p class="mt-1">{{ detail }}</p>
    </details>
  </li>
</template>

<script setup lang="ts">
import type { QualityLevel } from '~/utils/questionnaireQuality'
import { QUALITY_LEVELS } from '~/utils/questionnaireQualityText'

// Une ligne de l'encadré « Qualité du questionnaire » (SPEC-015, R2) : niveau, phrase, ce qu'il faut faire, détail replié
defineProps<{
  level: QualityLevel
  sentence: string
  todo: string
  detail: string
}>()
</script>
