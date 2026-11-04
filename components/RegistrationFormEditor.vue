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
            <!-- Proportions attendues (US-141) : pour la prévision, jamais montrées à l'inscrit -->
            <details v-if="isLinked(question)" class="text-sm">
              <summary class="cursor-pointer text-xs font-medium text-gray-600">Proportions attendues (facultatif)</summary>
              <p class="mt-1 text-xs text-gray-500">{{ question.type === 'multiple' ? MULTIPLE_SHARES_HELP : SHARES_HELP }}</p>
              <div class="mt-1 space-y-1">
                <div v-for="option in expectationOptions(question)" :key="option" class="grid grid-cols-3 items-center gap-2">
                  <span class="col-span-2 truncate text-gray-700">{{ question.type === 'scale' ? `Note ${option}` : option }}</span>
                  <UInput
                    :model-value="question.shares[option] ?? ''"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    size="sm"
                    :aria-label="`Part attendue : ${option}`"
                    @update:model-value="question.shares[option] = String($event ?? '')"
                  >
                    <template #trailing><span class="text-xs text-gray-500">%</span></template>
                  </UInput>
                </div>
              </div>
            </details>
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

        <RegistrationFormQuality :game-id="gameId" :refresh-key="qualityKey" @characters="trialCharacters = $event" />

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

        <RegistrationFormTrial v-if="trialOpen" v-model:open="trialOpen" :characters="trialCharacters" :questions="trialQuestions" :links="trialLinks" />
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
import { NO_VERSION } from '~/utils/offlineSync'
import { SCALE_OPTIONS, type QualityCharacter } from '~/utils/questionnaireQuality'

// Listes de réglages, sous une forme que les composants acceptent (les constantes sont en lecture seule)
const STANDARD_FIELDS: Array<{ key: RegistrationStandardFieldKey, label: string, description?: string }> = [...REGISTRATION_STANDARD_FIELDS]
const QUESTION_TYPES = [...REGISTRATION_QUESTION_TYPES]

type SavedForm = ApiResponse<'/api/games/:id/registration-form', 'put'>
type QuestionLinks = ApiResponse<'/api/games/:id/registration-question-links'>
type QuestionLink = QuestionLinks['links'][number]
type OptionExpectations = ApiResponse<'/api/games/:id/registration-option-expectations'>

const SHARES_HELP = 'Tout vide : chaque réponse a la même chance. Une réponse vide compte pour 0, et les parts sont ramenées à 100 % au total.'
const MULTIPLE_SHARES_HELP = 'La part des personnes qui cochent chaque option. Tout vide : chaque option est cochée une fois sur deux. Une option vide compte pour 0.'

// Question en cours d'édition : key sert au rendu, id (absent pour une nouvelle question) au serveur. optionLinks :
// les rôles de chaque option, par texte de l'option ; scaleLinks : ceux d'une question sur une échelle (US-098) ;
// shares : les parts attendues saisies, en %, par texte de l'option ou niveau de l'échelle (US-141)
type EditableQuestion = {
  key: number
  id?: string
  label: string
  type: RegistrationQuestionType
  required: boolean
  optionsText: string
  optionLinks: Record<string, string[]>
  scaleLinks: string[]
  shares: Record<string, string>
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
    const [linked, expected] = await Promise.all([
      useApiFetch(`/api/games/${props.gameId}/registration-question-links`),
      useApiFetch(`/api/games/${props.gameId}/registration-option-expectations`)
    ])
    linkTargets.value = linked.targets
    applyLinks(linked.links)
    applyExpectations(expected)
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
    scaleLinks: [],
    shares: {}
  }
}

const parseOptions = (text: string | undefined) => String(text ?? '').split('\n').map((option) => option.trim()).filter(Boolean)

/**
 * Les rôles et la part attendue suivent le texte de leur option : ajouter, retirer ou déplacer une ligne ne les change
 * pas d'option. Une ligne modifiée à la même place, quand le nombre d'options ne change pas, est un renommage : elle les garde.
 */
function setOptionsText(question: EditableQuestion, text: string) {
  const before = parseOptions(question.optionsText)
  const after = parseOptions(text)
  const links: Record<string, string[]> = {}
  const shares: Record<string, string> = {}
  after.forEach((option, index) => {
    const previous = before[index]
    const renamed = before.length === after.length && !before.includes(option) && previous !== undefined && !after.includes(previous) ? previous : null
    const keptLinks = question.optionLinks[option] ?? (renamed ? question.optionLinks[renamed] : undefined)
    if (keptLinks?.length) links[option] = keptLinks
    const keptShare = question.shares[option] ?? (renamed ? question.shares[renamed] : undefined)
    if (keptShare) shares[option] = keptShare
  })
  question.optionsText = text
  question.optionLinks = links
  question.shares = shares
}
const questionOptions = (question: EditableQuestion) => REGISTRATION_CHOICE_TYPES.includes(question.type) ? parseOptions(question.optionsText) : []
const definitionQuestions = () => questions.value.map((question) => ({
  ...(question.id ? { id: question.id } : {}),
  label: question.label,
  type: question.type,
  required: question.required,
  options: questionOptions(question)
}))

// Les questions telles qu'elles seront posées, même avant l'enregistrement : une nouvelle question a un identifiant provisoire
const draftId = (question: EditableQuestion) => question.id ?? `brouillon-${question.key}`
const draftQuestions = computed(() => questions.value
  .filter((question) => question.label.trim())
  .map((question) => ({ id: draftId(question), label: question.label.trim(), type: question.type, required: question.required, options: questionOptions(question) })))

const previewDefinition = computed(() => ({
  affinities: affinities.value,
  balance: { ...balance.value, ...(balanceAttribute.value || {}) },
  questions: draftQuestions.value
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

// Un lien par question, option et rôle
function draftLinks(drafts: ReturnType<typeof linkDrafts>) {
  return questions.value.flatMap((question, index) => (drafts[index] || []).flatMap(({ option, values }) => values.map((value) => {
    const [kind = '', id = ''] = value.split(':')
    return { question, option, kind, id }
  })))
}

function linksPayload(drafts: ReturnType<typeof linkDrafts>) {
  return draftLinks(drafts).map(({ question, option, kind, id }) => ({ questionId: question.id, option, [`${kind}Id`]: id }))
}

// Proportions attendues (US-141), pour les questions reliées. La version lue évite d'écraser un autre membre de l'équipe ; le dernier
// contenu lu ou enregistré évite de faire avancer cette version quand rien n'a changé
const expectationsVersion = ref<string | null>(null)
let savedExpectations = ''

const expectationOptions = (question: EditableQuestion) => (question.type === 'scale' ? SCALE_OPTIONS : questionOptions(question))
const isLinked = (question: EditableQuestion) => (question.type === 'scale' ? question.scaleLinks.length > 0 : questionOptions(question).some((option) => question.optionLinks[option]?.length))

function applyExpectations({ expectations, version }: OptionExpectations) {
  for (const question of questions.value) {
    // Quatre décimales : une part en % se relit telle qu'elle a été saisie, sans 7,000000000000001
    question.shares = Object.fromEntries(expectations.filter((row) => row.questionId === question.id).map((row) => [row.option, String(Number((row.share * 100).toFixed(4)))]))
  }
  expectationsVersion.value = version
  savedExpectations = JSON.stringify(expectationsPayload(expectationDrafts()))
}

// Parts saisies, question par question dans l'ordre : comme les liens, relues après l'enregistrement du formulaire
function expectationDrafts() {
  return questions.value.map((question) => (isLinked(question)
    ? expectationOptions(question).flatMap((option) => (question.shares[option] ? [{ option, share: Number(question.shares[option]) / 100 }] : []))
    : []))
}

function expectationsPayload(drafts: ReturnType<typeof expectationDrafts>) {
  return questions.value.flatMap((question, index) => (drafts[index] ?? []).map((row) => ({ questionId: question.id ?? '', ...row })))
}

// Ce qui serait refusé, à dire avant d'enregistrer quoi que ce soit (R6)
function expectationProblem(drafts: ReturnType<typeof expectationDrafts>) {
  for (const [index, rows] of drafts.entries()) {
    const question = questions.value[index]!
    if (rows.some(({ share }) => !(share >= 0 && share <= 1))) return `« ${question.label} » : une part va de 0 à 100 %.`
    if (rows.length && question.type !== 'multiple' && rows.every(({ share }) => !share)) return `« ${question.label} » : au moins une part doit être positive, ou laissez-les toutes vides.`
  }
  return ''
}

// Essai du questionnaire (US-135) : les questions et les liens en cours, et les personnages PJ que l'encadré a lus (null avant sa lecture)
const trialOpen = ref(false)
const trialCharacters = ref<QualityCharacter[] | null>(null)
const trialQuestions = computed(() => draftQuestions.value.filter((question) => question.type !== 'text'))
const trialLinks = computed(() => {
  const { characters, factions, intrigues } = linkTargets.value
  const names = new Map<string, string>([
    ...characters.map((entry) => [`character:${entry.id}`, entry.name] as const),
    ...factions.map((entry) => [`faction:${entry.id}`, entry.name] as const),
    ...intrigues.map((entry) => [`intrigue:${entry.id}`, entry.name] as const)
  ])
  return draftLinks(linkDrafts()).map(({ question, option, kind, id }) => ({ questionId: draftId(question), option, target: { kind, id, name: names.get(`${kind}:${id}`) ?? '' } }))
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
  errorMessage.value = ''
  savedMessage.value = ''
  const expectationRows = expectationDrafts()
  const problem = expectationProblem(expectationRows)
  if (problem) {
    errorMessage.value = problem
    return
  }
  saving.value = true
  try {
    const previous = version.value?.number
    const drafts = linkDrafts()
    const shares = questions.value.map((question) => question.shares)
    const saved = await useApiFetch(`/api/games/${props.gameId}/registration-form`, {
      method: 'PUT',
      body: { standardFields: settings.value, affinities: affinities.value, balance: balance.value, questions: definitionQuestions(), baseVersionNumber: previous ?? null }
    })
    // Hors ligne, le formulaire part en file (ADR-0036) ; les rôles, qui attendent les identifiants des nouvelles
    // questions, ne peuvent pas suivre
    if (isOfflineQueued(saved)) {
      savedMessage.value = 'Hors ligne : le formulaire sera enregistré au retour du réseau, mais pas les rôles reliés aux options ni les proportions attendues. Indiquez-les de nouveau une fois le formulaire enregistré.'
      return
    }
    apply(saved)
    questions.value.forEach((question, index) => {
      question.shares = shares[index] ?? {}
    })
    // Les questions reviennent dans le même ordre, avec leurs identifiants : les liens suivent (US-098). Sans liens
    // chargés, on n'enregistre rien : une liste vide les effacerait tous
    let linksQueued = false
    if (linksLoaded.value) {
      const savedLinks = await useApiFetch(`/api/games/${props.gameId}/registration-question-links`, { method: 'PUT', body: { links: linksPayload(drafts) } })
      if (isOfflineQueued(savedLinks)) linksQueued = true
      else applyLinks(savedLinks.links)
      // Après les liens : sans eux, une question ne serait plus reliée
      const expectations = expectationsPayload(expectationRows)
      if (JSON.stringify(expectations) !== savedExpectations) {
        const savedShares = await useApiFetch(`/api/games/${props.gameId}/registration-option-expectations`, { method: 'PUT', body: { expectations, updatedAt: expectationsVersion.value ?? NO_VERSION } })
        if (isOfflineQueued(savedShares)) linksQueued = true
        else applyExpectations(savedShares)
      }
    }
    qualityKey.value++
    savedMessage.value = [
      version.value?.number === previous ? 'Aucun changement : la version en vigueur est conservée.' : `Version ${version.value?.number} enregistrée.`,
      linksQueued ? 'Hors ligne : les rôles et les proportions seront enregistrés au retour du réseau.' : ''
    ].filter(Boolean).join(' ')
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}
</script>
