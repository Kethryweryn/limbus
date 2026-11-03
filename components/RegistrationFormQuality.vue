<template>
  <section class="space-y-2">
    <h3 class="font-semibold">Qualité du questionnaire</h3>
    <p v-if="errorMessage" class="text-sm text-error-600">{{ errorMessage }}</p>
    <template v-else-if="quality">
      <p v-if="!quality.characterCount" class="text-sm text-gray-500">Le jeu n’a pas encore de personnage PJ : rien à juger.</p>
      <p v-else-if="!quality.questionCount" class="text-sm text-gray-500">
        Aucune question à choix ni échelle : le questionnaire ne sert pas encore au casting.
      </p>
      <p v-else-if="!quality.findings.length" class="text-sm text-success-700">
        Bon : chaque personnage PJ est relié à une réponse, et les liens permettent de choisir entre eux.
      </p>
      <ul v-else class="space-y-2">
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
      <p class="text-xs text-gray-500">Ces repères portent sur le formulaire et les liens enregistrés.</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { QualityLevel, QuestionnaireFinding } from '~/utils/questionnaireQuality'
import { apiErrorMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

// Encadré « Qualité du questionnaire » de l'éditeur du formulaire (US-133, US-134, SPEC-015) : relu à chaque
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

watch(() => [props.gameId, props.refreshKey], async () => {
  errorMessage.value = ''
  try {
    quality.value = await useApiFetch(`/api/games/${props.gameId}/registration-form-quality`, { offlineCache: true })
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible de calculer la qualité du questionnaire')
  }
}, { immediate: true })

const items = computed(() => (quality.value?.findings ?? []).map((finding) => ({ level: finding.level, ...describe(finding) })))

const decimal = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

// Phrase, ce qu'il faut faire, et détail replié (valeur, seuil, référence) de chaque repère (SPEC-015, R2)
function describe(finding: QuestionnaireFinding) {
  switch (finding.kind) {
    case 'characterWithoutLink':
      return {
        sentence: `${finding.character.name} n’est relié à aucune réponse : l’assistant ne pourra lui proposer personne.`,
        todo: 'Reliez une option à ce personnage, à sa faction ou à son intrigue.',
        detail: 'Note maximale possible : 0 point. SPEC-015, R4.'
      }
    case 'questionWithoutLink':
      return {
        sentence: `« ${finding.questionLabel} » n’est reliée à aucun rôle : ses réponses ne comptent pas dans le casting.`,
        todo: 'Reliez ses réponses à des personnages, des factions ou des intrigues, ou laissez-la ainsi si elle ne sert pas au casting.',
        detail: 'Aucun lien sur la question. SPEC-015, R5.'
      }
    case 'optionWithoutLink':
      return {
        sentence: `L’option « ${finding.option} » de « ${finding.questionLabel} » n’est reliée à aucun rôle.`,
        todo: 'Reliez-la à un rôle, ou laissez-la ainsi si elle ne doit rapprocher de personne.',
        detail: 'Aucun lien sur l’option, alors que la question en a. SPEC-015, R5.'
      }
    case 'indistinctCharacters': {
      const [first, second] = finding.characters
      const { separating } = finding
      return {
        sentence: `${first.name} et ${second.name} rapportent presque les mêmes points pour chaque réponse : le questionnaire aura du mal à les départager.`,
        todo: separating
          ? `La réponse qui les sépare le plus est « ${separating.option || 'note haute'} » à « ${separating.questionLabel} », en faveur de ${separating.favors.name} : reliez d’autres réponses à l’un sans l’autre.`
          : `Aucune réponse ne les sépare : reliez une réponse à ${first.name} sans ${second.name}, ou l’inverse.`,
        detail: `Similarité cosinus des profils de points : ${decimal(finding.similarity)}. Seuil : ${decimal(finding.threshold)}, choix de l’utilisatrice (« 8 points sur 10 en commun »). SPEC-015, R6 ; ADR-0061.`
      }
    }
  }
}
</script>
