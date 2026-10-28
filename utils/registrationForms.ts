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

export type RegistrationFormDefinition = {
  standardFields: Record<RegistrationStandardFieldKey, RegistrationFieldSetting>
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

// Un champ non demandé ne peut pas être obligatoire
export function normalizeRegistrationFormDefinition(definition: RegistrationFormDefinition): RegistrationFormDefinition {
  const standardFields = Object.fromEntries(REGISTRATION_STANDARD_FIELDS.map(({ key }) => {
    const setting = definition.standardFields[key] ?? DEFAULT_REGISTRATION_FORM_DEFINITION.standardFields[key]
    return [key, { asked: setting.asked, required: setting.asked && setting.required }]
  })) as RegistrationFormDefinition['standardFields']

  return { standardFields }
}

export function sameRegistrationFormDefinition(left: RegistrationFormDefinition, right: RegistrationFormDefinition) {
  return JSON.stringify(normalizeRegistrationFormDefinition(left)) === JSON.stringify(normalizeRegistrationFormDefinition(right))
}
