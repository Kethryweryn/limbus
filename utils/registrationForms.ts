// Champs standards du formulaire d'inscription (SPEC-001 R8, R14), partagés entre le serveur et l'interface.
// L'email est toujours demandé et obligatoire : il n'est pas réglable, donc absent de cette liste.
export const REGISTRATION_STANDARD_FIELDS = [
  { key: 'lastName', label: 'Nom' },
  { key: 'firstName', label: 'Prénom' },
  { key: 'facebookName', label: 'Nom Facebook', description: 'Pour retrouver la personne dans un groupe Facebook du jeu.' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'emergencyContact', label: 'Contact d’urgence', description: 'Nom et téléphone d’une personne à prévenir.' },
  { key: 'dietary', label: 'Allergies et intolérances alimentaires', description: 'Données de santé : leur saisie demande un consentement explicite.' }
] as const

export type RegistrationStandardFieldKey = typeof REGISTRATION_STANDARD_FIELDS[number]['key']

// Champs saisis par l'inscrit, dans l'ordre du formulaire : un réglage peut donner deux champs (contact d'urgence).
// Partagés par l'aperçu de l'éditeur et la page du lien personnel, pour que l'aperçu reste fidèle.
export const REGISTRATION_FORM_INPUTS: ReadonlyArray<{
  setting: RegistrationStandardFieldKey
  key: string
  label: string
  type?: string
  autocomplete?: string
  wide?: boolean
  multiline?: boolean
}> = [
  { setting: 'lastName', key: 'lastName', label: 'Nom', autocomplete: 'family-name' },
  { setting: 'firstName', key: 'firstName', label: 'Prénom', autocomplete: 'given-name' },
  { setting: 'phone', key: 'phone', label: 'Téléphone', type: 'tel', autocomplete: 'tel' },
  { setting: 'facebookName', key: 'facebookName', label: 'Nom Facebook' },
  { setting: 'emergencyContact', key: 'emergencyContactName', label: 'Contact d’urgence : nom' },
  { setting: 'emergencyContact', key: 'emergencyContactPhone', label: 'Contact d’urgence : téléphone', type: 'tel' },
  { setting: 'dietary', key: 'dietary', label: 'Allergies et intolérances alimentaires', wide: true, multiline: true }
]

// Longueur maximale d'une réponse ; les allergies peuvent demander une description détaillée
export const REGISTRATION_ANSWER_MAX_LENGTH = 500
export const REGISTRATION_DIETARY_MAX_LENGTH = 2000

export type RegistrationFieldSetting = { asked: boolean, required: boolean }

// Affinités (R8, ADR-0045) : chacune activable comme un champ standard ; la personne en écrit une par ligne
export const REGISTRATION_AFFINITIES = [
  { key: 'wantWith', label: 'Avec qui je veux jouer', hint: 'Une personne par ligne.' },
  { key: 'notWith', label: 'Avec qui je ne veux pas jouer', hint: 'Une personne par ligne.' },
  { key: 'refusedRelations', label: 'Les relations que je ne veux pas jouer', hint: 'Une relation par ligne (romance, lien familial…).' },
  { key: 'avoid', label: 'Les personnes que je ne veux pas croiser', hint: 'Une personne par ligne.' }
] as const

export type RegistrationAffinityKey = typeof REGISTRATION_AFFINITIES[number]['key']
export const REGISTRATION_AFFINITY_MAX_LINES = 20
export const REGISTRATION_AFFINITY_MAX_LENGTH = 200

// Questions propres au jeu (R8, ADR-0045)
export const REGISTRATION_QUESTION_TYPES = [
  { value: 'text', label: 'Texte libre' },
  { value: 'single', label: 'Choix unique' },
  { value: 'multiple', label: 'Choix multiple' },
  { value: 'scale', label: 'Échelle de 1 à 5' }
] as const

export type RegistrationQuestionType = typeof REGISTRATION_QUESTION_TYPES[number]['value']
export const REGISTRATION_CHOICE_TYPES: string[] = ['single', 'multiple']
export const REGISTRATION_QUESTION_MAX = 50
export const REGISTRATION_QUESTION_OPTION_MAX = 30
export const REGISTRATION_QUESTION_LABEL_MAX_LENGTH = 300
export const REGISTRATION_QUESTION_TEXT_MAX_LENGTH = 2000

// id : attribué par le serveur à la création de la question, stable d'une version à l'autre
export type RegistrationQuestion = {
  id: string
  label: string
  type: RegistrationQuestionType
  required: boolean
  options: string[]
}

// Une définition d'avant ADR-0045 n'a ni affinités ni questions : elle se lit sans elles
export type RegistrationFormDefinition = {
  standardFields: Record<RegistrationStandardFieldKey, RegistrationFieldSetting>
  affinities?: Partial<Record<RegistrationAffinityKey, RegistrationFieldSetting>>
  questions?: Array<Omit<RegistrationQuestion, 'id'> & { id?: string }>
}

export type NormalizedRegistrationFormDefinition = {
  standardFields: Record<RegistrationStandardFieldKey, RegistrationFieldSetting>
  affinities: Record<RegistrationAffinityKey, RegistrationFieldSetting>
  questions: RegistrationQuestion[]
}

export const DEFAULT_REGISTRATION_FORM_DEFINITION: RegistrationFormDefinition = {
  standardFields: {
    lastName: { asked: true, required: true },
    firstName: { asked: true, required: true },
    facebookName: { asked: false, required: false },
    phone: { asked: true, required: true },
    emergencyContact: { asked: true, required: true },
    dietary: { asked: true, required: false }
  }
}

const NOT_ASKED: RegistrationFieldSetting = { asked: false, required: false }
const setting = (value: RegistrationFieldSetting | undefined, fallback: RegistrationFieldSetting) => {
  const chosen = value ?? fallback
  return { asked: chosen.asked, required: chosen.asked && chosen.required }
}

// Un champ non demandé ne peut pas être obligatoire ; une question sans choix n'a pas d'options
export function normalizeRegistrationFormDefinition(definition: RegistrationFormDefinition): NormalizedRegistrationFormDefinition {
  const standardFields = Object.fromEntries(REGISTRATION_STANDARD_FIELDS.map(({ key }) =>
    [key, setting(definition.standardFields[key], DEFAULT_REGISTRATION_FORM_DEFINITION.standardFields[key])]
  )) as NormalizedRegistrationFormDefinition['standardFields']
  const affinities = Object.fromEntries(REGISTRATION_AFFINITIES.map(({ key }) =>
    [key, setting(definition.affinities?.[key], NOT_ASKED)]
  )) as NormalizedRegistrationFormDefinition['affinities']
  const questions = (definition.questions ?? []).map((question) => ({
    id: question.id ?? '',
    label: question.label.trim(),
    type: question.type,
    required: Boolean(question.required),
    options: REGISTRATION_CHOICE_TYPES.includes(question.type)
      ? [...new Set((question.options ?? []).map((option) => option.trim()).filter(Boolean))]
      : []
  }))

  return { standardFields, affinities, questions }
}

export function sameRegistrationFormDefinition(left: RegistrationFormDefinition, right: RegistrationFormDefinition) {
  return JSON.stringify(normalizeRegistrationFormDefinition(left)) === JSON.stringify(normalizeRegistrationFormDefinition(right))
}
