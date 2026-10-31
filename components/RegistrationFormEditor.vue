<template>
  <UModal v-model:open="open" :title="`Formulaire d’inscription · ${gameTitle}`" :ui="{ content: 'sm:max-w-3xl' }">
    <template #body>
      <div class="space-y-6">
        <p class="text-sm text-gray-500">
          {{ versionLabel }}
          Modifier le formulaire crée une nouvelle version : les inscriptions déjà reçues gardent la leur.
        </p>

        <section class="space-y-2">
          <h3 class="font-semibold">Informations demandées</h3>
          <p class="text-sm text-gray-500">L’email est toujours demandé et obligatoire.</p>
          <div
            v-for="field in REGISTRATION_STANDARD_FIELDS"
            :key="field.key"
            class="flex flex-col gap-2 rounded border border-gray-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <div class="font-medium text-gray-800">{{ field.label }}</div>
              <div v-if="field.description" class="text-xs text-gray-500">{{ field.description }}</div>
            </div>
            <div class="flex shrink-0 gap-4">
              <UCheckbox
                :model-value="settings[field.key].asked"
                label="Demandé"
                @update:model-value="setAsked(field.key, $event)"
              />
              <UCheckbox
                v-model="settings[field.key].required"
                label="Obligatoire"
                :disabled="!settings[field.key].asked"
              />
            </div>
          </div>
        </section>

        <section class="space-y-2">
          <h3 class="font-semibold">Affinités</h3>
          <p class="text-sm text-gray-500">La personne écrit une personne, ou une relation, par ligne.</p>
          <div
            v-for="affinity in REGISTRATION_AFFINITIES"
            :key="affinity.key"
            class="flex flex-col gap-2 rounded border border-gray-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="font-medium text-gray-800">{{ affinity.label }}</div>
            <div class="flex shrink-0 gap-4">
              <UCheckbox
                :model-value="affinities[affinity.key].asked"
                label="Demandée"
                @update:model-value="setAffinityAsked(affinity.key, $event)"
              />
              <UCheckbox
                v-model="affinities[affinity.key].required"
                label="Obligatoire"
                :disabled="!affinities[affinity.key].asked"
              />
            </div>
          </div>
        </section>

        <section class="space-y-2">
          <h3 class="font-semibold">Questions propres au jeu</h3>
          <p v-if="!questions.length" class="text-sm text-gray-500">Aucune question pour l’instant.</p>
          <div v-for="(question, index) in questions" :key="question.key" class="space-y-2 rounded border border-gray-200 p-3">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <UFormField label="Question" class="sm:col-span-2">
                <UInput v-model="question.label" class="w-full" />
              </UFormField>
              <UFormField label="Sorte">
                <USelect v-model="question.type" :items="REGISTRATION_QUESTION_TYPES" value-key="value" class="w-full" />
              </UFormField>
            </div>
            <UFormField v-if="REGISTRATION_CHOICE_TYPES.includes(question.type)" label="Options" description="Une option par ligne, deux au moins.">
              <UTextarea v-model="question.optionsText" :rows="3" class="w-full" />
            </UFormField>
            <div class="flex flex-wrap items-center gap-3">
              <UCheckbox v-model="question.required" label="Obligatoire" />
              <div class="ml-auto flex gap-1">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-up" :disabled="index === 0" aria-label="Monter" @click="moveQuestion(index, -1)" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-down" :disabled="index === questions.length - 1" aria-label="Descendre" @click="moveQuestion(index, 1)" />
                <UButton size="xs" color="error" variant="ghost" icon="i-heroicons-trash" aria-label="Retirer" @click="questions.splice(index, 1)" />
              </div>
            </div>
          </div>
          <UButton size="sm" color="neutral" variant="soft" icon="i-heroicons-plus" @click="addQuestion">Ajouter une question</UButton>
        </section>

        <section class="space-y-3">
          <h3 class="font-semibold">Aperçu</h3>
          <div class="space-y-4 rounded border border-dashed border-gray-300 p-4">
            <div>
              <div class="text-sm font-medium text-gray-700">Note d’intention</div>
              <p v-if="noteIntention" class="mt-1 whitespace-pre-line text-sm text-gray-600">{{ noteIntention }}</p>
              <p v-else class="mt-1 text-sm italic text-gray-400">Le jeu n’a pas encore de note d’intention : renseignez-la dans la fiche du jeu.</p>
            </div>
            <UCheckbox disabled label="J’ai lu la note d’intention et j’y adhère *" />

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Email *">
                <UInput disabled class="w-full" />
              </UFormField>
              <UFormField
                v-for="field in previewFields"
                :key="field.key"
                :label="`${field.label}${field.required ? ' *' : ''}`"
                :class="field.wide ? 'sm:col-span-2' : ''"
              >
                <UTextarea v-if="field.multiline" disabled :rows="2" class="w-full" />
                <UInput v-else disabled class="w-full" />
              </UFormField>
            </div>
            <RegistrationExtraFields :definition="previewDefinition" disabled />
            <UCheckbox
              v-if="settings.dietary.asked"
              disabled
              label="J’accepte que ces informations de santé soient transmises aux organisateurs et à l’équipe cuisine (obligatoire si je déclare des allergies)"
            />
          </div>
        </section>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          :description="errorMessage"
        />
        <UAlert
          v-if="savedMessage"
          color="success"
          variant="soft"
          :description="savedMessage"
        />

        <div class="flex flex-wrap gap-2">
          <UButton color="primary" :loading="saving" @click="save">Enregistrer</UButton>
          <UButton color="neutral" variant="soft" @click="open = false">Fermer</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  REGISTRATION_AFFINITIES,
  REGISTRATION_CHOICE_TYPES,
  REGISTRATION_FORM_INPUTS,
  REGISTRATION_QUESTION_TYPES,
  REGISTRATION_STANDARD_FIELDS
} from '~/utils/registrationForms'
import { apiErrorMessage } from '~/utils/apiErrors'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  gameId: { type: String, required: true },
  gameTitle: { type: String, required: true }
})

const settings = ref(cloneSettings(DEFAULT_REGISTRATION_FORM_DEFINITION.standardFields))
const affinities = ref(cloneSettings({}, REGISTRATION_AFFINITIES))
// Questions en cours d'édition : key sert au rendu, id (absent pour une nouvelle question) au serveur
const questions = ref([])
let nextKey = 0
const version = ref(null)
const noteIntention = ref('')
const errorMessage = ref('')
const savedMessage = ref('')
const saving = ref(false)

watch(open, async (value) => {
  if (!value) return
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    apply(await useApiFetch(`/api/games/${props.gameId}/registration-form`))
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Impossible de charger le formulaire'
  }
})

const versionLabel = computed(() => version.value
  ? `Version ${version.value.number}, enregistrée le ${new Date(version.value.createdAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}.`
  : 'Formulaire par défaut, jamais enregistré.')

// Champs affichés dans l'aperçu, dans l'ordre où l'inscrit les verra (même liste que la page du lien)
const previewFields = computed(() => REGISTRATION_FORM_INPUTS
  .filter((input) => settings.value[input.setting].asked)
  .map((input) => ({ ...input, required: settings.value[input.setting].required })))

// Sans réglage enregistré (affinités d'un ancien formulaire), le champ n'est pas demandé
function cloneSettings(values, fields = REGISTRATION_STANDARD_FIELDS) {
  return Object.fromEntries(fields.map(({ key }) => [key, { ...(values[key] ?? { asked: false, required: false }) }]))
}

const editableQuestion = (question) => ({ key: nextKey++, id: question.id, label: question.label, type: question.type, required: question.required, optionsText: question.options.join('\n') })
const questionOptions = (question) => REGISTRATION_CHOICE_TYPES.includes(question.type) ? question.optionsText.split('\n').map((option) => option.trim()).filter(Boolean) : []
const definitionQuestions = () => questions.value.map((question) => ({
  ...(question.id ? { id: question.id } : {}),
  label: question.label,
  type: question.type,
  required: question.required,
  options: questionOptions(question)
}))

// L'aperçu montre les questions telles qu'elles seront posées, même avant l'enregistrement
const previewDefinition = computed(() => ({
  affinities: affinities.value,
  questions: definitionQuestions().filter((question) => question.label.trim()).map((question, index) => ({ ...question, id: question.id || `apercu-${index}` }))
}))

function addQuestion() {
  questions.value.push(editableQuestion({ label: '', type: 'text', required: false, options: [] }))
}

function moveQuestion(index, offset) {
  const [question] = questions.value.splice(index, 1)
  questions.value.splice(index + offset, 0, question)
}

function setAffinityAsked(key, asked) {
  affinities.value[key].asked = asked
  if (!asked) affinities.value[key].required = false
}

function apply(data) {
  settings.value = cloneSettings(data.definition.standardFields)
  affinities.value = cloneSettings(data.definition.affinities ?? {}, REGISTRATION_AFFINITIES)
  questions.value = (data.definition.questions ?? []).map(editableQuestion)
  version.value = data.version
  if (data.game) noteIntention.value = data.game.noteIntention || ''
}

// Un champ non demandé ne peut pas être obligatoire
function setAsked(key, asked) {
  settings.value[key].asked = asked
  if (!asked) settings.value[key].required = false
}

async function save() {
  saving.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    const previous = version.value?.number
    apply(await useApiFetch(`/api/games/${props.gameId}/registration-form`, {
      method: 'PUT',
      body: { standardFields: settings.value, affinities: affinities.value, questions: definitionQuestions(), baseVersionNumber: previous ?? null }
    }))
    savedMessage.value = version.value?.number === previous
      ? 'Aucun changement : la version en vigueur est conservée.'
      : `Version ${version.value.number} enregistrée.`
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}
</script>
