<template>
  <section class="space-y-2">
    <h3 class="font-semibold">Qualité du questionnaire</h3>
    <p v-if="errorMessage" class="text-sm text-error-600">{{ errorMessage }}</p>
    <template v-else-if="quality">
      <p v-if="!quality.characterCount" class="text-sm text-gray-500">Le jeu n’a pas encore de personnage PJ : les repères sur les personnages viendront avec eux.</p>
      <p v-if="!quality.questionCount" class="text-sm text-gray-500">
        Aucune question à choix ni échelle : le questionnaire ne sert pas encore au casting.
      </p>
      <p v-if="quality.characterCount && quality.questionCount && !quality.findings.length && (!quality.estimate || quality.estimate.level === 'good')" class="text-sm text-success-700">
        Bon : chaque personnage PJ est relié à une réponse, et les liens permettent de choisir entre eux.{{ quality.estimate ? ' Les réponses reçues ne signalent rien non plus.' : '' }}
      </p>
      <div v-if="estimate" class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h4 class="text-sm font-medium">Estimation générale</h4>
          <UBadge :color="QUALITY_LEVELS[estimate.level].color" variant="subtle" size="sm">{{ QUALITY_LEVELS[estimate.level].label }}</UBadge>
        </div>
        <ul class="space-y-2">
          <QualityFindingItem v-if="estimate.note" v-bind="estimate.note" />
          <QualityFindingItem v-bind="estimate.ties" />
        </ul>
        <p v-if="estimate.summary" class="text-sm text-gray-600">{{ estimate.summary }}</p>
      </div>
      <ul v-if="items.length" class="space-y-2">
        <QualityFindingItem v-for="(item, index) in items" :key="index" v-bind="item" />
      </ul>
      <p class="text-xs text-gray-500">{{ scope }}</p>
      <RegistrationFormForecast v-if="forecastInput" :input="forecastInput" :collapsed="quality.hasAnswers" />
      <!-- Une lecture hors ligne d'avant US-144 n'a pas les signalements -->
      <RegistrationFormDrafting v-if="quality.drafting && quality.drafting.wordCounts.length" :review="quality.drafting" :collapsed="quality.hasAnswers" />
    </template>
  </section>
</template>

<script setup lang="ts">
import { linkedQuestions, type QualityCharacter } from '~/utils/questionnaireQuality'
import { describeEstimate, describeFinding, QUALITY_LEVELS, qualityScope } from '~/utils/questionnaireQualityText'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

// Encadré « Qualité du questionnaire » de l'éditeur du formulaire (US-133, US-134, US-136 à US-140, US-142 à US-144, SPEC-015) : relu à chaque
// enregistrement (refreshKey)
const props = defineProps<{
  gameId: string
  refreshKey: number
}>()

// Les personnages PJ lus par la route, pour l'essai du questionnaire (US-135) ; null si une lecture hors ligne d'avant US-135 ne les a pas
const emit = defineEmits<{ characters: [characters: QualityCharacter[] | null] }>()

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
    emit('characters', result.characters ?? null)
    errorMessage.value = ''
  } catch (err) {
    if (request === lastRequest) errorMessage.value = apiErrorMessage(err, 'Impossible de calculer la qualité du questionnaire')
  }
}, { immediate: true })

const items = computed(() => (quality.value?.findings ?? []).map((finding) => ({ level: finding.level, ...describeFinding(finding) })))

const estimate = computed(() => {
  if (!quality.value?.estimate) return null
  return describeEstimate(quality.value.estimate, quality.value.findings.filter((finding) => finding.level === 'review').length)
})

const scope = computed(() => qualityScope(quality.value?.respondentCount ?? 0))

// Ce que la prévision calcule (US-142, US-143), sans proxy réactif pour passer au Web Worker. Sans question reliée ni personnage,
// ou si une lecture hors ligne ancienne n'a pas ces données, il n'y a pas de prévision
const forecastInput = computed(() => {
  const raw = toRaw(quality.value)
  if (!raw?.forecastInput || !raw.characters?.length || !linkedQuestions(raw.forecastInput.questions, raw.forecastInput.links).length) return null
  return { ...raw.forecastInput, characters: raw.characters }
})
</script>
