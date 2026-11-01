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
        :error="errors[`affinities.${affinity.key}`]"
      >
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
          :model-value="answers[question.id] || ''"
          :rows="3"
          :disabled="disabled"
          class="w-full"
          @update:model-value="setAnswer(question.id, $event)"
        />
        <URadioGroup
          v-else-if="question.type === 'single'"
          :model-value="answers[question.id] ?? undefined"
          :items="question.options"
          :disabled="disabled"
          @update:model-value="setAnswer(question.id, $event)"
        />
        <!-- Un groupe, pas des cases isolées : dans un champ, chaque case prendrait le libellé du champ -->
        <UCheckboxGroup
          v-else-if="question.type === 'multiple'"
          :model-value="answers[question.id] || []"
          :items="question.options"
          :disabled="disabled"
          @update:model-value="setAnswer(question.id, $event)"
        />
        <URadioGroup
          v-else
          :model-value="answers[question.id] ?? undefined"
          :items="SCALE"
          orientation="horizontal"
          :disabled="disabled"
          @update:model-value="setAnswer(question.id, $event)"
        />
      </UFormField>
    </section>
  </div>
</template>

<script setup>
import { REGISTRATION_AFFINITIES, REGISTRATION_BALANCE_ANY } from '~/utils/registrationForms'

// Affinités, question d'équilibre et questions propres au jeu d'un formulaire (US-081, US-082, US-091) : la page de réponse et l'aperçu de l'éditeur
const props = defineProps({
  // Définition normalisée (affinities, questions)
  definition: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
  errors: { type: Object, default: () => ({}) }
})
const affinities = defineModel('affinities', { type: Object, default: () => ({}) })
const answers = defineModel('answers', { type: Object, default: () => ({}) })
const balancePreference = defineModel('balancePreference', { type: String, default: null })

const balanceAsked = computed(() => Boolean(props.definition.balance?.asked && props.definition.balance?.values?.length))
const balanceItems = computed(() => [
  ...(props.definition.balance?.values || []).map((value) => ({ label: value, value })),
  { label: 'Peu importe', value: REGISTRATION_BALANCE_ANY }
])

const SCALE = [1, 2, 3, 4, 5].map((value) => ({ label: String(value), value }))

const askedAffinities = computed(() => REGISTRATION_AFFINITIES
  .filter(({ key }) => props.definition.affinities?.[key]?.asked)
  .map((affinity) => ({ ...affinity, required: props.definition.affinities[affinity.key].required })))

// Une ligne par personne ou relation ; les lignes vides sont retirées à l'enregistrement
function setAffinity(key, text) {
  affinities.value = { ...affinities.value, [key]: String(text ?? '').split('\n') }
}

function setAnswer(id, value) {
  answers.value = { ...answers.value, [id]: value }
}
</script>
