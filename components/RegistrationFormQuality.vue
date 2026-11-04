<template>
  <section class="space-y-2">
    <h3 class="font-semibold">Qualité du questionnaire</h3>
    <p v-if="errorMessage" class="text-sm text-error-600">{{ errorMessage }}</p>
    <template v-else-if="quality">
      <p v-if="!quality.characterCount" class="text-sm text-gray-500">Le jeu n’a pas encore de personnage PJ : les repères sur les personnages viendront avec eux.</p>
      <p v-if="!quality.questionCount" class="text-sm text-gray-500">
        Aucune question à choix ni échelle : le questionnaire ne sert pas encore au casting.
      </p>
      <p v-if="quality.characterCount && quality.questionCount && !quality.findings.length" class="text-sm text-success-700">
        Bon : chaque personnage PJ est relié à une réponse, et les liens permettent de choisir entre eux.{{ quality.respondentCount ? ' Les réponses reçues ne signalent rien non plus.' : '' }}
      </p>
      <ul v-if="items.length" class="space-y-2">
        <li v-for="(item, index) in items" :key="index" class="rounded border border-gray-200 px-3 py-2 text-sm">
          <div class="flex flex-wrap items-start gap-2">
            <UBadge :color="LEVELS[item.level].color" variant="subtle" size="sm">{{ LEVELS[item.level].label }}</UBadge>
            <span class="min-w-0 flex-1 text-gray-800">{{ item.sentence }}</span>
          </div>
          <p class="mt-1 text-gray-600">{{ item.todo }}</p>
          <details class="mt-1 text-xs text-gray-500">
            <summary class="cursor-pointer">Détail</summary>
            <p class="mt-1">{{ item.detail }}</p>
          </details>
        </li>
      </ul>
      <p class="text-xs text-gray-500">{{ scope }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { QualityLevel } from '~/utils/questionnaireQuality'
import { describeFinding, qualityScope } from '~/utils/questionnaireQualityText'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

// Encadré « Qualité du questionnaire » de l'éditeur du formulaire (US-133, US-134, US-136 à US-139, SPEC-015) : relu à chaque
// enregistrement (refreshKey)
const props = defineProps<{
  gameId: string
  refreshKey: number
}>()

const LEVELS: Record<QualityLevel, { label: string, color: 'success' | 'warning' | 'error' | 'neutral' }> = {
  good: { label: 'Bon', color: 'success' },
  watch: { label: 'À surveiller', color: 'warning' },
  review: { label: 'À revoir', color: 'error' },
  unsure: { label: 'À confirmer', color: 'neutral' }
}

const quality = ref<ApiResponse<'/api/games/:id/registration-form-quality'> | null>(null)
const errorMessage = ref('')
// Seule la dernière lecture compte : une réponse plus lente d'une lecture précédente est ignorée
let lastRequest = 0

watch(() => [props.gameId, props.refreshKey], async () => {
  const request = ++lastRequest
  try {
    const result = await useApiFetch(`/api/games/${props.gameId}/registration-form-quality`, { offlineCache: true })
    if (request !== lastRequest) return
    quality.value = result
    errorMessage.value = ''
  } catch (err) {
    if (request === lastRequest) errorMessage.value = apiErrorMessage(err, 'Impossible de calculer la qualité du questionnaire')
  }
}, { immediate: true })

const items = computed(() => (quality.value?.findings ?? []).map((finding) => ({ level: finding.level, ...describeFinding(finding) })))

const scope = computed(() => qualityScope(quality.value?.respondentCount ?? 0))
</script>
