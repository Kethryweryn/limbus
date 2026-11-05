<template>
  <details :open="!collapsed" class="space-y-2">
    <summary class="cursor-pointer">
      <span class="inline-flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium">Rédaction</span>
        <UBadge :color="QUALITY_LEVELS[flagCount ? 'watch' : 'good'].color" variant="subtle" size="sm">{{ QUALITY_LEVELS[flagCount ? 'watch' : 'good'].label }}</UBadge>
        <span v-if="flagCount" class="text-xs text-gray-500">{{ flagCount }} signalement{{ flagCount > 1 ? 's' : '' }}</span>
      </span>
    </summary>
    <p v-if="!flagCount" class="text-sm text-gray-600">Les règles de relecture ne signalent aucune question.</p>
    <div v-for="question in review.questions" :key="question.questionId" class="space-y-1">
      <p class="text-sm font-medium text-gray-700">{{ question.label }}</p>
      <ul class="space-y-2">
        <QualityFindingItem v-for="flag in question.flags" :key="flag.rule" v-bind="describeDraftingFlag(flag, review.wordCounts)" />
      </ul>
    </div>
    <p class="text-xs text-gray-500">Sur le formulaire enregistré. Une règle de mots se trompe parfois : ces signalements invitent à vérifier, sans obliger à corriger.</p>
  </details>
</template>

<script setup lang="ts">
import type { DraftingReview } from '~/utils/questionnaireDrafting'
import { describeDraftingFlag, draftingFlagCount } from '~/utils/questionnaireDraftingText'
import { QUALITY_LEVELS } from '~/utils/questionnaireQualityText'

// Partie « Rédaction » de l'encadré « Qualité du questionnaire » (US-144, SPEC-016, R11)
const props = defineProps<{
  review: DraftingReview
  collapsed: boolean
}>()

const flagCount = computed(() => draftingFlagCount(props.review))
</script>
