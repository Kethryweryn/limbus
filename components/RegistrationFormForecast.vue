<template>
  <details :open="!collapsed" class="space-y-2">
    <summary class="cursor-pointer">
      <span class="inline-flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium">Prévision</span>
        <UBadge v-if="forecast" :color="QUALITY_LEVELS[forecast.level].color" variant="subtle" size="sm">{{ QUALITY_LEVELS[forecast.level].label }}</UBadge>
      </span>
    </summary>
    <p v-if="failed" class="text-sm text-error-600">Impossible de calculer la prévision.</p>
    <template v-else-if="forecast">
      <ul class="space-y-2">
        <QualityFindingItem v-for="(item, index) in describeForecast(forecast)" :key="index" v-bind="item" />
      </ul>
      <p class="text-xs text-gray-500">{{ forecastScope(forecast) }}</p>
    </template>
    <p v-else class="text-sm text-gray-500">Calcul de la prévision…</p>
  </details>
</template>

<script setup lang="ts">
import type { ForecastInput, QuestionnaireForecast } from '~/utils/questionnaireForecast'
import { describeForecast, forecastScope } from '~/utils/questionnaireForecastText'
import { QUALITY_LEVELS } from '~/utils/questionnaireQualityText'

// Partie « Prévision » de l'encadré « Qualité du questionnaire » (US-142, US-143, SPEC-016, R4) : calculée hors du fil principal
const props = defineProps<{
  input: ForecastInput
  collapsed: boolean
}>()

const forecast = shallowRef<QuestionnaireForecast | null>(null)
const failed = ref(false)
let worker: Worker | null = null

function stop() {
  worker?.terminate()
  worker = null
}

// L'ancienne prévision reste affichée pendant le calcul de la nouvelle, le temps d'un enregistrement
watch(() => props.input, (input) => {
  stop()
  failed.value = false
  const current = new Worker(new URL('../utils/questionnaireForecast.worker.ts', import.meta.url), { type: 'module' })
  current.onmessage = ({ data }: MessageEvent<QuestionnaireForecast>) => {
    forecast.value = data
    stop()
  }
  current.onerror = () => {
    failed.value = true
    forecast.value = null
    stop()
  }
  current.postMessage(input)
  worker = current
}, { immediate: true })

onBeforeUnmount(stop)
</script>
