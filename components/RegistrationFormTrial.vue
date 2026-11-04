<template>
  <UModal v-model:open="open" title="Essayer le questionnaire" :ui="{ content: 'sm:max-w-4xl' }">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-gray-500">Répondez comme un joueur, à partir de l’éditeur tel qu’il est. Rien n’est enregistré : cet essai n’est ni une inscription ni une réponse.</p>
        <p v-if="!questions.length" class="text-sm text-gray-500">Aucune question à choix ni échelle : ajoutez-en dans l’éditeur pour essayer le questionnaire.</p>
        <p v-else-if="!hasLinks" class="text-sm text-gray-500">Aucune question n’est reliée à un rôle : reliez des réponses à des personnages, des factions ou des intrigues dans l’éditeur pour voir des notes.</p>

        <div v-if="questions.length" class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RegistrationExtraFields v-model:answers="answers" :definition="definition" />
          <section class="space-y-3">
            <h3 class="font-semibold">Personnages</h3>
            <p v-if="!characters" class="text-sm text-gray-500">Les personnages ne sont pas encore chargés.</p>
            <p v-else-if="!characters.length" class="text-sm text-gray-500">Le jeu n’a pas encore de personnage PJ.</p>
            <ol v-if="ranking.ranked.length" class="space-y-2">
              <li v-for="entry in ranking.ranked" :key="entry.id" class="rounded border border-gray-200 px-3 py-2 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="min-w-0 flex-1 font-medium text-gray-800">{{ entry.name }}</span>
                  <UBadge v-if="entry.tied" color="neutral" variant="subtle" size="sm">Ex æquo</UBadge>
                  <span class="text-gray-600">{{ formatScore(entry.score) }} point{{ entry.score >= 2 ? 's' : '' }}</span>
                </div>
                <p v-for="(component, index) in entry.components" :key="index" class="mt-1 text-xs text-gray-500">{{ component.label }} (+{{ formatScore(component.points) }})</p>
              </li>
            </ol>
            <div v-if="ranking.unreached.length" class="text-sm">
              <p class="font-medium text-gray-700">Qu’aucune réponse donnée ne rejoint</p>
              <p class="text-gray-500">{{ ranking.unreached.join(', ') }}</p>
            </div>
          </section>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { formatScore, type CastingLink } from '~/utils/castingAssistant'
import type { QualityCharacter } from '~/utils/questionnaireQuality'
import { trialRanking } from '~/utils/questionnaireTrial'
import { DEFAULT_REGISTRATION_FORM_DEFINITION, normalizeRegistrationFormDefinition, type QuestionAnswers, type RegistrationQuestion } from '~/utils/registrationForms'

// Essai du questionnaire par l'équipe (US-135, SPEC-016, R1 à R3) : monté à l'ouverture, il oublie les réponses en se fermant
const props = defineProps<{
  // Personnages PJ que l'encadré a lus ; null avant sa lecture
  characters: QualityCharacter[] | null
  // Questions et liens en cours dans l'éditeur, même pas encore enregistrés
  questions: RegistrationQuestion[]
  links: CastingLink[]
}>()
const open = defineModel<boolean>('open', { default: false })

const answers = ref<QuestionAnswers>({})

const definition = computed(() => normalizeRegistrationFormDefinition({ ...DEFAULT_REGISTRATION_FORM_DEFINITION, questions: props.questions }))
const hasLinks = computed(() => {
  const ids = new Set(props.questions.map((question) => question.id))
  return props.links.some((link) => ids.has(link.questionId))
})
const ranking = computed(() => trialRanking(props.characters ?? [], props.questions, props.links, answers.value))
</script>
