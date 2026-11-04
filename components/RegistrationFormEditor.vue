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
            v-for="field in STANDARD_FIELDS"
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
                @update:model-value="setAsked(settings[field.key], $event)"
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
                @update:model-value="setAsked(affinities[affinity.key], $event)"
              />
              <UCheckbox
                v-model="affinities[affinity.key].required"
                label="Obligatoire"
                :disabled="!affinities[affinity.key].asked"
              />
            </div>
          </div>
        </section>

        <!-- Question d'équilibre (US-091) : sur l'attribut d'équilibre défini dans la fiche du jeu -->
        <section class="space-y-2">
          <h3 class="font-semibold">Question d’équilibre</h3>
          <div
            v-if="balanceAttribute"
            class="flex flex-col gap-2 rounded border border-gray-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="font-medium text-gray-800">{{ balanceAttribute.label }} : ma préférence</div>
              <div class="text-xs text-gray-500">{{ balanceAttribute.values.join(', ') }} ou « Peu importe ». Sert au tirage avec équilibre.</div>
            </div>
            <div class="flex shrink-0 gap-4">
              <UCheckbox :model-value="balance.asked" label="Demandée" @update:model-value="setAsked(balance, $event)" />
              <UCheckbox v-model="balance.required" label="Obligatoire" :disabled="!balance.asked" />
            </div>
          </div>
          <p v-else class="text-sm text-gray-500">
            Définissez d’abord un attribut d’équilibre (par exemple le genre du personnage) dans la fiche du jeu.
          </p>
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
                <USelect v-model="question.type" :items="QUESTION_TYPES" value-key="value" class="w-full" />
              </UFormField>
            </div>
            <UFormField v-if="REGISTRATION_CHOICE_TYPES.includes(question.type)" label="Options" description="Une option par ligne, deux au moins.">
              <UTextarea :model-value="question.optionsText" :rows="3" class="w-full" @update:model-value="setOptionsText(question, $event)" />
            </UFormField>
            <!-- Rôles que désigne chaque réponse (US-098) : jamais montrés à l'inscrit -->
            <div v-if="hasLinkTargets && REGISTRATION_CHOICE_TYPES.includes(question.type) && questionOptions(question).length" class="space-y-1">
              <p class="text-xs font-medium text-gray-600">Rôles désignés par chaque option (visibles de l’équipe seulement)</p>
              <div v-for="(option, optionIndex) in questionOptions(question)" :key="optionIndex" class="grid grid-cols-1 items-center gap-1 sm:grid-cols-3">
                <span class="truncate text-sm text-gray-700">{{ option }}</span>
                <USelectMenu
                  :model-value="question.optionLinks[option] || []"
                  :items="linkItems"
                  value-key="value"
                  multiple
                  size="sm"
                  placeholder="Personnages, factions, intrigues…"
                  class="sm:col-span-2"
                  @update:model-value="question.optionLinks[option] = $event"
                />
              </div>
            </div>
            <UFormField
              v-if="hasLinkTargets && question.type === 'scale'"
              label="Rôles désignés"
              description="Plus la note est haute, plus ces rôles conviennent. Visibles de l’équipe seulement."
            >
              <USelectMenu v-model="question.scaleLinks" :items="linkItems" value-key="value" multiple placeholder="Personnages, factions, intrigues…" class="w-full" />
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
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" color="neutral" variant="soft" icon="i-heroicons-plus" @click="addQuestion">Ajouter une question</UButton>
            <UButton size="sm" color="neutral" variant="soft" icon="i-heroicons-play" :disabled="!linksLoaded" @click="trialOpen = true">Essayer le questionnaire</UButton>
          </div>
        </section>

        <RegistrationFormQuality :game-id="gameId" :refresh-key="qualityKey" />

        <section class="space-y-3">
          <h3 class="font-semibold">Aperçu</h3>
          <div class="space-y-4 rounded border border-dashed border-gray-300 p-4">
            <div>
              <div class="text-sm font-medium text-gray-700">Note d’intention</div>
              <p v-if="noteIntention" class="mt-1 whitespace-pre-line text-sm text-gray-600">{{ noteIntention }}</p>
              <p v-else class="mt-1 text-sm italic text-gray-400">Le jeu n’a pas encore de note d’intention : renseignez-la dans la fiche du jeu.</p>
            </div>
            <UCheckbox disabled :label="`${REGISTRATION_CHARTER_LABEL} *`" />

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
            <UCheckbox v-if="settings.dietary.asked" disabled :label="REGISTRATION_HEALTH_CONSENT_LABEL" />
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

        <RegistrationFormTrial v-if="trialOpen" v-model:open="trialOpen" :game-id="gameId" :questions="trialQuestions" :links="trialLinks" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  REGISTRATION_AFFINITIES,
  REGISTRATION_CHARTER_LABEL,
  REGISTRATION_CHOICE_TYPES,
  REGISTRATION_HEALTH_CONSENT_LABEL,
  REGISTRATION_QUESTION_TYPES,
  REGISTRATION_STANDARD_FIELDS,
  askedRegistrationInputs,
  type RegistrationFieldSetting,
  type RegistrationQuestion,
  type RegistrationQuestionType,
  type RegistrationStandardFieldKey
} from '~/utils/registrationForms'
import { apiErrorMessage } from '~/utils/apiErrors'
import { formatLongDateTime } from '~/utils/dates'
import { isOfflineQueued, type ApiResponse } from '~/composables/useApiFetch'

// Listes de réglages, sous une forme que les composants acceptent (les constantes sont en lecture seule)
const STANDARD_FIELDS: Array<{ key: RegistrationStandardFieldKey, label: string, description?: string }> = [...REGISTRATION_STANDARD_FIELDS]
const QUESTION_TYPES = [...REGISTRATION_QUESTION_TYPES]

type SavedForm = ApiResponse<'/api/games/:id/registration-form', 'put'>
type QuestionLinks = ApiResponse<'/api/games/:id/registration-question-links'>
type QuestionLink = QuestionLinks['links'][number]

// Question en cours d'édition : key sert au rendu, id (absent pour une nouvelle question) au serveur. optionLinks :
// les rôles de chaque option, par texte de l'option ; scaleLinks : ceux d'une question sur une échelle (US-098)
type EditableQuestion = {
  key: number
  id?: string
  label: string
  type: RegistrationQuestionType
  required: boolean
  optionsText: string
  optionLinks: Record<string, string[]>
  scaleLinks: string[]
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  gameId: string
  gameTitle: string
}>()

const settings = ref(cloneSettings(REGISTRATION_STANDARD_FIELDS, DEFAULT_REGISTRATION_FORM_DEFINITION.standardFields))
const affinities = ref(cloneSettings(REGISTRATION_AFFINITIES, {}))
const questions = ref<EditableQuestion[]>([])
const balance = ref<RegistrationFieldSetting>({ asked: false, required: false })
// Nom et valeurs de l'attribut d'équilibre du jeu ; null sans attribut
const balanceAttribute = ref<{ label: string, values: string[] } | null>(null)
let nextKey = 0
const version = ref<SavedForm['version']>(null)
const noteIntention = ref('')
const errorMessage = ref('')
const savedMessage = ref('')
const saving = ref(false)
// Relit l'encadré « Qualité du questionnaire » après chaque enregistrement (US-133)
const qualityKey = ref(0)

watch(open, async (value) => {
  if (!value) return
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    const current = await useApiFetch(`/api/games/${props.gameId}/registration-form`)
    apply(current)
    noteIntention.value = current.game.noteIntention || ''
    linksLoaded.value = false
    const linked = await useApiFetch(`/api/games/${props.gameId}/registration-question-links`)
    linkTargets.value = linked.targets
    applyLinks(linked.links)
    linksLoaded.value = true
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Impossible de charger le formulaire')
  }
})

const versionLabel = computed(() => version.value
  ? `Version ${version.value.number}, enregistrée le ${formatLongDateTime(version.value.createdAt)}.`
  : 'Formulaire par défaut, jamais enregistré.')

// Champs affichés dans l'aperçu, dans l'ordre où l'inscrit les verra (même liste que la page du lien)
const previewFields = computed(() => askedRegistrationInputs(settings.value))

// Sans réglage enregistré (affinités d'un ancien formulaire), le champ n'est pas demandé
function cloneSettings<K extends string>(fields: ReadonlyArray<{ key: K }>, values: Partial<Record<K, RegistrationFieldSetting>>) {
  return Object.fromEntries(fields.map(({ key }) => [key, { ...(values[key] ?? { asked: false, required: false }) }])) as Record<K, RegistrationFieldSetting>
}

function editableQuestion(question: Omit<RegistrationQuestion, 'id'> & { id?: string }): EditableQuestion {
  return {
    key: nextKey++,
    id: question.id,
    label: question.label,
    type: question.type,
    required: question.required,
    optionsText: question.options.join('\n'),
    optionLinks: {},
    scaleLinks: []
  }
}

const parseOptions = (text: string | undefined) => String(text ?? '').split('\n').map((option) => option.trim()).filter(Boolean)

/**
 * Les rôles suivent le texte de leur option : ajouter, retirer ou déplacer une ligne ne les change pas d'option. Une
 * ligne modifiée à la même place, quand le nombre d'options ne change pas, est un renommage : elle garde ses rôles.
 */
function setOptionsText(question: EditableQuestion, text: string) {
  const before = parseOptions(question.optionsText)
  const after = parseOptions(text)
  const links: Record<string, string[]> = {}
  after.forEach((option, index) => {
    const previous = before[index]
    const renamed = before.length === after.length && !before.includes(option) && previous !== undefined && !after.includes(previous) ? previous : null
    const kept = question.optionLinks[option] ?? (renamed ? question.optionLinks[renamed] : undefined)
    if (kept?.length) links[option] = kept
  })
  question.optionsText = text
  question.optionLinks = links
}
const questionOptions = (question: EditableQuestion) => REGISTRATION_CHOICE_TYPES.includes(question.type) ? parseOptions(question.optionsText) : []
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
  balance: { ...balance.value, ...(balanceAttribute.value || {}) },
  questions: definitionQuestions().filter((question) => question.label.trim()).map((question, index) => ({ ...question, id: question.id || `apercu-${index}` }))
}))

function addQuestion() {
  questions.value.push(editableQuestion({ label: '', type: 'text', required: false, options: [] }))
}

function moveQuestion(index: number, offset: number) {
  const [question] = questions.value.splice(index, 1)
  questions.value.splice(index + offset, 0, question!)
}

// Un champ non demandé ne peut pas être obligatoire
function setAsked(setting: RegistrationFieldSetting, checked: boolean | 'indeterminate') {
  setting.asked = checked === true
  if (!setting.asked) setting.required = false
}

// Liens du questionnaire (US-098) : « character:id », « faction:id » ou « intrigue:id »
const linkTargets = ref<QuestionLinks['targets']>({ characters: [], factions: [], intrigues: [] })
const linksLoaded = ref(false)
const hasLinkTargets = computed(() => Object.values(linkTargets.value).some((list) => list.length))
const linkItems = computed(() => [
  linkTargets.value.characters.map((entry) => ({ label: entry.name, value: `character:${entry.id}` })),
  linkTargets.value.factions.map((entry) => ({ label: `${entry.name} (faction)`, value: `faction:${entry.id}` })),
  linkTargets.value.intrigues.map((entry) => ({ label: `${entry.name} (intrigue)`, value: `intrigue:${entry.id}` }))
].filter((group) => group.length))

function applyLinks(links: QuestionLink[]) {
  const value = (link: QuestionLink) => `${link.target.kind}:${link.target.id}`
  for (const question of questions.value) {
    const mine = links.filter((link) => link.questionId === question.id)
    question.scaleLinks = mine.filter((link) => link.option === '').map(value)
    question.optionLinks = Object.fromEntries(questionOptions(question).map((option) => [option, mine.filter((link) => link.option === option).map(value)]))
  }
}

// Liens à enregistrer, question par question dans l'ordre : relus après l'enregistrement du formulaire, qui donne
// leurs identifiants aux nouvelles questions
function linkDrafts() {
  return questions.value.map((question) => question.type === 'scale'
    ? [{ option: '', values: question.scaleLinks }]
    : questionOptions(question).map((option) => ({ option, values: question.optionLinks[option] || [] })))
}

function linksPayload(drafts: ReturnType<typeof linkDrafts>) {
  return questions.value.flatMap((question, index) => (drafts[index] || []).flatMap(({ option, values }) => values.map((value) => {
    const [kind, id] = value.split(':')
    return { questionId: question.id, option, [`${kind}Id`]: id }
  })))
}

// Essai du questionnaire (US-135) : les questions et les liens en cours, une nouvelle question ayant un identifiant provisoire
const trialOpen = ref(false)
const trialId = (question: EditableQuestion) => question.id ?? `essai-${question.key}`
const trialQuestions = computed(() => questions.value
  .filter((question) => question.label.trim() && question.type !== 'text')
  .map((question) => ({ id: trialId(question), label: question.label, type: question.type, required: question.required, options: questionOptions(question) })))
const trialLinks = computed(() => {
  const names = new Map(linkItems.value.flat().map(({ label, value }) => [value, label]))
  const drafts = linkDrafts()
  return questions.value.flatMap((question, index) => (drafts[index] || []).flatMap(({ option, values }) => values.map((value) => {
    const [kind = '', id = ''] = value.split(':')
    return { questionId: trialId(question), option, target: { kind, id, name: names.get(value) ?? '' } }
  })))
})

function apply(data: SavedForm) {
  settings.value = cloneSettings(REGISTRATION_STANDARD_FIELDS, data.definition.standardFields)
  affinities.value = cloneSettings(REGISTRATION_AFFINITIES, data.definition.affinities)
  questions.value = data.definition.questions.map(editableQuestion)
  const { asked, required, label, values } = data.definition.balance
  balance.value = { asked, required }
  balanceAttribute.value = label && values?.length ? { label, values } : null
  version.value = data.version
}

async function save() {
  saving.value = true
  errorMessage.value = ''
  savedMessage.value = ''
  try {
    const previous = version.value?.number
    const drafts = linkDrafts()
    const saved = await useApiFetch(`/api/games/${props.gameId}/registration-form`, {
      method: 'PUT',
      body: { standardFields: settings.value, affinities: affinities.value, balance: balance.value, questions: definitionQuestions(), baseVersionNumber: previous ?? null }
    })
    // Hors ligne, le formulaire part en file (ADR-0036) ; les rôles, qui attendent les identifiants des nouvelles
    // questions, ne peuvent pas suivre
    if (isOfflineQueued(saved)) {
      savedMessage.value = 'Hors ligne : le formulaire sera enregistré au retour du réseau, mais pas les rôles reliés aux options. Reliez-les de nouveau une fois le formulaire enregistré.'
      return
    }
    apply(saved)
    // Les questions reviennent dans le même ordre, avec leurs identifiants : les liens suivent (US-098). Sans liens
    // chargés, on n'enregistre rien : une liste vide les effacerait tous
    let linksQueued = false
    if (linksLoaded.value) {
      const savedLinks = await useApiFetch(`/api/games/${props.gameId}/registration-question-links`, { method: 'PUT', body: { links: linksPayload(drafts) } })
      if (isOfflineQueued(savedLinks)) linksQueued = true
      else applyLinks(savedLinks.links)
    }
    qualityKey.value++
    savedMessage.value = [
      version.value?.number === previous ? 'Aucun changement : la version en vigueur est conservée.' : `Version ${version.value?.number} enregistrée.`,
      linksQueued ? 'Hors ligne : les rôles seront enregistrés au retour du réseau.' : ''
    ].filter(Boolean).join(' ')
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}
</script>
