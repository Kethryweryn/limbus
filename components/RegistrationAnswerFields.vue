<template>
  <!-- Réponses au formulaire d'inscription (US-004, US-084) : la page du lien personnel ou du compte, et le formulaire de diffusion -->
  <div class="space-y-5">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField label="Email" required :error="errors.email">
        <UInput v-model="form.email" type="email" autocomplete="email" :disabled="disabled || emailLocked" class="w-full" />
      </UFormField>
      <UFormField
        v-for="field in textFields"
        :key="field.key"
        :label="field.label"
        :required="field.required"
        :error="errors[field.key]"
        :class="field.wide ? 'sm:col-span-2' : ''"
      >
        <UTextarea v-if="field.multiline" v-model.nullable="form[field.key]" :rows="3" :disabled="disabled" class="w-full" />
        <UInput v-else v-model.nullable="form[field.key]" :type="field.type || 'text'" :autocomplete="field.autocomplete" :disabled="disabled" class="w-full" />
      </UFormField>
    </div>

    <UFormField
      v-if="availabilitySessions"
      label="Sessions où vous êtes disponible"
      description="Facultatif : c’est une pré-inscription, sans place garantie. L’équipe choisit ensuite pour chaque session."
      :error="errors.availableSessionIds"
    >
      <!-- Un groupe, pas des cases isolées : dans un champ, chaque case prendrait le libellé du champ -->
      <UCheckboxGroup v-model="form.availableSessionIds" :items="sessionItems" :disabled="disabled" />
    </UFormField>

    <RegistrationExtraFields
      v-model:affinities="form.affinities"
      v-model:answers="form.questionAnswers"
      v-model:balance-preference="form.balancePreference"
      :definition="definition"
      :disabled="disabled"
      :errors="errors"
    />

    <!-- Champ piège du formulaire de diffusion -->
    <slot />

    <UFormField v-if="definition.standardFields.dietary.asked" :error="errors.healthConsent">
      <UCheckbox v-model="form.healthConsent" :disabled="disabled" :label="REGISTRATION_HEALTH_CONSENT_LABEL" />
    </UFormField>
    <UFormField :error="errors.charterAccepted">
      <UCheckbox v-model="form.charterAccepted" :disabled="disabled" :label="REGISTRATION_CHARTER_LABEL" required />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import {
  REGISTRATION_CHARTER_LABEL,
  REGISTRATION_HEALTH_CONSENT_LABEL,
  askedRegistrationInputs,
  type NormalizedRegistrationFormDefinition,
  type RegistrationAnswerForm
} from '~/utils/registrationForms'
import { PARIS_TIME_ZONE, formatLongDate } from '~/utils/dates'

const props = withDefaults(defineProps<{
  definition: NormalizedRegistrationFormDefinition
  // Sessions proposées quand le formulaire demande les disponibilités (R10), sinon null
  availabilitySessions?: Array<{ id: string, name: string, date: string | null }> | null
  disabled?: boolean
  // Email tenu par le compte ou par l'invitation : la personne ne le change pas ici
  emailLocked?: boolean
  errors?: Record<string, string>
}>(), { availabilitySessions: null, disabled: false, emailLocked: false, errors: () => ({}) })
const form = defineModel<RegistrationAnswerForm>('form', { required: true })

// Champs demandés, dans l'ordre de l'aperçu du formulaire (US-002)
const textFields = computed(() => askedRegistrationInputs(props.definition.standardFields))

// Dates à l'heure de Paris : la page de diffusion est rendue par le serveur
const sessionItems = computed(() => (props.availabilitySessions || []).map((session) => ({
  value: session.id,
  label: session.date ? `${session.name} · ${formatLongDate(session.date, PARIS_TIME_ZONE)}` : session.name
})))
</script>
