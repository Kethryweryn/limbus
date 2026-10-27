<template>
  <UModal v-model:open="open" title="Formulaire d’inscription" :ui="{ content: 'sm:max-w-3xl' }">
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
import { DEFAULT_REGISTRATION_FORM_DEFINITION, REGISTRATION_STANDARD_FIELDS } from '~/utils/registrationForms'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  gameId: { type: String, required: true }
})

const settings = ref(cloneSettings(DEFAULT_REGISTRATION_FORM_DEFINITION.standardFields))
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

// Champs affichés dans l'aperçu, dans l'ordre où l'inscrit les verra
const previewFields = computed(() => {
  const fields = []
  const add = (key, label, extra = {}) => {
    if (settings.value[key].asked) fields.push({ key: `${key}-${label}`, label, required: settings.value[key].required, ...extra })
  }
  add('lastName', 'Nom')
  add('firstName', 'Prénom')
  add('phone', 'Téléphone')
  add('facebookName', 'Nom Facebook')
  add('emergencyContact', 'Contact d’urgence : nom')
  add('emergencyContact', 'Contact d’urgence : téléphone')
  add('dietary', 'Allergies et intolérances alimentaires', { wide: true, multiline: true })
  return fields
})

function cloneSettings(standardFields) {
  return Object.fromEntries(Object.entries(standardFields).map(([key, setting]) => [key, { ...setting }]))
}

function apply(data) {
  settings.value = cloneSettings(data.definition.standardFields)
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
      body: { standardFields: settings.value }
    }))
    savedMessage.value = version.value?.number === previous
      ? 'Aucun changement : la version en vigueur est conservée.'
      : `Version ${version.value.number} enregistrée.`
  } catch (err) {
    errorMessage.value = err?.data?.message || err?.message || 'Enregistrement impossible'
  } finally {
    saving.value = false
  }
}
</script>
