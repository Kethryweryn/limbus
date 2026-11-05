<template>
  <div class="space-y-5">
    <section v-if="askedAffinities.length" class="space-y-3">
      <h3 class="font-semibold">Affinités</h3>
      <UFormField
        v-for="affinity in askedAffinities"
        :key="affinity.key"
        :label="affinity.label"
        :description="affinity.hint"
        :required="affinity.required"
        :error="errors[`affinities.${affinity.key}`] || (affinity.key === 'refusedRelations' ? errors['affinities.refusedRelationTypes'] : undefined)"
      >
        <!-- Relations refusées (US-099) : des cases que l'assistant de casting lit, puis le texte pour préciser -->
        <UCheckboxGroup
          v-if="affinity.key === 'refusedRelations'"
          class="mb-2"
          orientation="horizontal"
          :model-value="affinities.refusedRelationTypes || []"
          :items="refusedRelationItems"
          value-key="value"
          :disabled="disabled"
          @update:model-value="setRefusedTypes"
        />
        <UTextarea
          :model-value="(affinities[affinity.key] || []).join('\n')"
          :rows="3"
          :disabled="disabled"
          class="w-full"
          @update:model-value="setAffinity(affinity.key, $event)"
        />
      </UFormField>
    </section>

    <section v-if="definition.questions.length || balanceAsked" class="space-y-4">
      <h3 class="font-semibold">Questions</h3>
      <!-- Question d'équilibre (US-091) : les valeurs de l'attribut du jeu, et « Peu importe » -->
      <UFormField
        v-if="balanceAsked"
        :label="`${definition.balance.label} : ma préférence`"
        :required="definition.balance.required"
        :error="errors.balancePreference"
      >
        <URadioGroup
          :model-value="balancePreference ?? undefined"
          :items="balanceItems"
          :disabled="disabled"
          @update:model-value="balancePreference = $event"
        />
      </UFormField>
      <UFormField
        v-for="question in definition.questions"
        :key="question.id || question.label"
        :label="question.label"
        :required="question.required"
        :error="errors[`questionAnswers.${question.id}`]"
      >
        <UTextarea
          v-if="question.type === 'text'"
          :model-value="textAnswer(question.id)"
          :rows="3"
          :disabled="disabled"
          class="w-full"
          @update:model-value="setAnswer(question.id, $event)"
        />
        <URadioGroup
          v-else-if="question.type === 'single'"
          :model-value="singleAnswer(question.id)"
          :items="displayedOptions(question)"
          :disabled="disabled"
          @update:model-value="setAnswer(question.id, $event)"
        />
        <!-- Un groupe, pas des cases isolées : dans un champ, chaque case prendrait le libellé du champ -->
        <UCheckboxGroup
          v-else-if="question.type === 'multiple'"
          :model-value="multipleAnswer(question.id)"
          :items="displayedOptions(question)"
          :disabled="disabled"
          @update:model-value="setAnswer(question.id, $event)"
        />
        <URadioGroup
          v-else
          :model-value="scaleAnswer(question.id)"
          :items="SCALE"
          orientation="horizontal"
          :disabled="disabled"
          @update:model-value="setAnswer(question.id, $event)"
        />
      </UFormField>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  REGISTRATION_AFFINITIES,
  REGISTRATION_BALANCE_ANY,
  optionsInDrawnOrder,
  type AffinityAnswers,
  type NormalizedRegistrationFormDefinition,
  type QuestionAnswers,
  type RegistrationAffinityKey,
  type RegistrationQuestion
} from '~/utils/registrationForms'
import { REFUSED_RELATION_CHOICES, REFUSED_RELATION_NONE } from '~/utils/characterRelations'

// Affinités, question d'équilibre et questions propres au jeu d'un formulaire (US-081, US-082, US-091) : la page de réponse et l'aperçu de l'éditeur
const props = withDefaults(defineProps<{
  // Définition normalisée ; l'aperçu de l'éditeur n'a pas les champs standards
  definition: Pick<NormalizedRegistrationFormDefinition, 'affinities' | 'questions' | 'balance'>
  disabled?: boolean
  errors?: Record<string, string>
}>(), { disabled: false, errors: () => ({}) })
const affinities = defineModel<Partial<AffinityAnswers>>('affinities', { default: () => ({}) })
const answers = defineModel<QuestionAnswers>('answers', { default: () => ({}) })
const balancePreference = defineModel<string | null>('balancePreference', { default: null })

const balanceAsked = computed(() => Boolean(props.definition.balance?.asked && props.definition.balance?.values?.length))
const balanceItems = computed(() => [
  ...(props.definition.balance?.values || []).map((value) => ({ label: value, value })),
  { label: 'Peu importe', value: REGISTRATION_BALANCE_ANY }
])

// Mélange des options (US-146, ADR-0062) : le rendu serveur garde l'ordre saisi, puis l'ordre tiré après le montage reste celui de
// la question : ni répondre ni corriger une option ne le refait
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const drawnOrders = new Map<string, string[]>()
function displayedOptions(question: RegistrationQuestion) {
  if (!mounted.value || !question.shuffleOptions) return question.options
  const order = optionsInDrawnOrder(drawnOrders.get(question.id), question.options)
  drawnOrders.set(question.id, order)
  return order
}

const SCALE = [1, 2, 3, 4, 5].map((value) => ({ label: String(value), value }))

const askedAffinities = computed(() => REGISTRATION_AFFINITIES
  .filter(({ key }) => props.definition.affinities?.[key]?.asked)
  .map((affinity) => ({ ...affinity, required: props.definition.affinities[affinity.key].required })))

// Une ligne par personne ou relation ; les lignes vides sont retirées à l'enregistrement
function setAffinity(key: RegistrationAffinityKey, text: string | undefined) {
  affinities.value = { ...affinities.value, [key]: String(text ?? '').split('\n') }
}

// « Aucune, tout me va » s'exclut avec les types : cocher l'une décoche les autres
function setRefusedTypes(checked: unknown[]) {
  const values = checked.filter((value): value is string => typeof value === 'string')
  const previous = affinities.value.refusedRelationTypes || []
  const noneAdded = values.includes(REFUSED_RELATION_NONE) && !previous.includes(REFUSED_RELATION_NONE)
  affinities.value = {
    ...affinities.value,
    refusedRelationTypes: noneAdded ? [REFUSED_RELATION_NONE] : values.filter((value) => value !== REFUSED_RELATION_NONE)
  }
}

function setAnswer(id: string, value: QuestionAnswers[string] | undefined) {
  answers.value = { ...answers.value, [id]: value ?? null }
}

const refusedRelationItems: Array<{ value: string, label: string }> = [...REFUSED_RELATION_CHOICES]

// Réponse selon la sorte de question : texte, choix unique, choix multiple, échelle
function textAnswer(id: string) {
  const answer = answers.value[id]
  return typeof answer === 'string' ? answer : ''
}
function singleAnswer(id: string) {
  const answer = answers.value[id]
  return typeof answer === 'string' ? answer : undefined
}
function multipleAnswer(id: string) {
  const answer = answers.value[id]
  return Array.isArray(answer) ? answer : []
}
function scaleAnswer(id: string) {
  const answer = answers.value[id]
  return typeof answer === 'number' ? answer : undefined
}
</script>
