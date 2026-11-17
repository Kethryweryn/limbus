import { parsePhoneNumberFromString } from 'libphonenumber-js/max'
import { z } from 'zod'

// Règles de saisie communes aux routes, au questionnaire et aux outils des assistants (SPEC-023, ADR-0092) : une règle
// s'écrit ici, une seule fois

export const PERSON_NAME_MAX_LENGTH = 100

// Nom de personne (R1) : lettres de tout alphabet (accents compris), espace, trait d'union, apostrophe, point ; au moins
// une lettre, à n'importe quelle place (« 't Hooft »)
const PERSON_NAME_PATTERN = /^(?=.*\p{L})[\p{L}\p{M} '’.-]+$/u

// Plafond lisible : « 1 000 000 caractères au plus », espaces insécables entre les milliers
export const tooLong = (label: string, max: number) => `${label} : ${String(max).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} caractères au plus`

// Longueur maximale de chaque texte saisi, selon son type (R9). Les plafonds déjà posés ailleurs (questionnaire,
// allergies, relations, tarifs, emails d'annulation) ne changent pas
export const TEXT_MAX = {
  personName: PERSON_NAME_MAX_LENGTH,
  // Titre ou nom d'un élément : jeu, personnage, groupe, intrigue, lieu, objet, document, événement
  title: 200,
  // Adresse, emplacement, note de trombinoscope, réglages d'envoi
  short: 500,
  // Accroche, description, présentation, note d'intention, notes
  long: 50_000,
  // Historique d'un personnage ou d'un groupe, contenu d'un document
  background: 1_000_000
} as const
export type TextKind = keyof typeof TEXT_MAX

/** Texte obligatoire, au plafond de son type. */
export function requiredTextField(kind: TextKind, label: string) {
  return z.string({ error: `${label} est obligatoire` }).trim().min(1, `${label} est obligatoire`).max(TEXT_MAX[kind], tooLong(label, TEXT_MAX[kind]))
}

/** Texte facultatif, au plafond de son type. */
export function optionalTextField(kind: TextKind, label: string) {
  return z.string().trim().max(TEXT_MAX[kind], tooLong(label, TEXT_MAX[kind])).optional().nullable()
}

export const EMAIL_MAX_LENGTH = 254

/** Adresse email obligatoire (R10) : en minuscules, 254 caractères au plus, de la forme d'une adresse. */
// Vide, seul « obligatoire » est rendu : « Email invalide » l'écraserait sous le champ
export function requiredEmail(label = 'L’email') {
  return z.string({ error: `${label} est obligatoire` }).trim().min(1, { message: `${label} est obligatoire`, abort: true }).toLowerCase()
    .max(EMAIL_MAX_LENGTH, tooLong(label, EMAIL_MAX_LENGTH)).email('Email invalide')
}

/**
 * Adresse email facultative (R10) : vide, elle reste vide ; absente (undefined) ou nulle, elle le reste aussi, car une
 * modification lit une valeur absente comme « ne pas changer ».
 */
export function optionalEmail(label = 'L’email') {
  return z.string().trim().toLowerCase().max(EMAIL_MAX_LENGTH, tooLong(label, EMAIL_MAX_LENGTH))
    .refine((value) => !value || z.email().safeParse(value).success, 'Email invalide')
    .optional().nullable()
}
export const personNameMessage = (label: string) =>
  `${label} ne peut contenir que des lettres, des espaces, des traits d’union, des apostrophes et des points`

// Espaces en double ou aux extrémités retirés : « Jean   Martin » devient « Jean Martin »
export const collapseSpaces = (value: string) => value.replace(/\s+/g, ' ').trim()

export function isPersonName(value: string) {
  return PERSON_NAME_PATTERN.test(value)
}

// Contrôles d'un nom déjà débarrassé de ses espaces superflus, vide exclu
function checkPersonName(label: string) {
  return z.string()
    .max(PERSON_NAME_MAX_LENGTH, tooLong(label, PERSON_NAME_MAX_LENGTH))
    .refine(isPersonName, personNameMessage(label))
}

/** Nom de personne obligatoire (R1, R2). */
export function personName(label = 'Le nom') {
  return z.string({ error: `${label} est obligatoire` })
    .transform(collapseSpaces)
    .pipe(z.string().min(1, `${label} est obligatoire`).pipe(checkPersonName(label)))
}

/**
 * Nom d'une modification : seulement obligatoire ici, car une valeur déjà en base garde sa forme tant qu'elle ne change
 * pas (R12). La route vérifie R1 par `assertChangedPersonName`, avec la valeur enregistrée.
 */
export function enteredPersonName(label = 'Le nom') {
  return z.string({ error: `${label} est obligatoire` }).transform(collapseSpaces).pipe(z.string().min(1, `${label} est obligatoire`))
}

/** Nom facultatif d'une modification : vide ou absent devient null ; R1 vérifiée par `assertChangedPersonName`. */
export function optionalEnteredPersonName() {
  return z.string().optional().nullable().transform((value) => value == null ? null : collapseSpaces(value) || null)
}

/**
 * Vérifie R1 sur un nom modifié, au format d'un refus de validation (champ `path`). Un nom identique à une valeur
 * enregistrée, aux espaces près, passe tel quel : la règle s'applique à la prochaine modification du champ (R12).
 */
export function assertChangedPersonName(path: string, label: string, value: string | null | undefined, saved: Array<string | null | undefined>) {
  if (value == null || saved.some((previous) => previous != null && collapseSpaces(previous) === value)) return
  const checked = checkPersonName(label).safeParse(value)
  if (!checked.success) refuseField(path, checked.error.issues.map((issue) => issue.message))
}

// Refus d'un champ, de la même forme qu'un refus de readZodBody (h3 range le détail sous data.data) : l'écran le met
// sous le champ
function refuseField(path: string, messages: string[]): never {
  const issues = messages.map((message) => ({ path, message }))
  throw createError({ statusCode: 400, statusMessage: 'Validation Error', message: 'Requête invalide', data: { statusCode: 400, message: 'Requête invalide', data: issues } })
}

export const PHONE_MESSAGE = 'Numéro de téléphone invalide'

// Chiffres, un + au début, et les séparateurs tolérés (R5) : la bibliothèque, elle, extrairait un numéro d'un texte
const PHONE_CHARACTERS = /^\+?[\d\s.()-]+$/

/**
 * Téléphone rangé au format international (« +33612345678 »), ou null s'il n'est pas reconnu (R4 à R6) : vérifié selon
 * le plan de numérotation de son pays, français sans indicatif ; séparateurs et « (0) » après l'indicatif retirés.
 */
export function normalizePhone(value: string) {
  const typed = value.trim()
  if (!PHONE_CHARACTERS.test(typed)) return null
  const parsed = parsePhoneNumberFromString(typed, 'FR')
  return parsed?.isValid() ? parsed.number : null
}

function checkPhone() {
  return z.string().transform((value, ctx) => {
    const phone = normalizePhone(value)
    if (phone) return phone
    ctx.addIssue({ code: 'custom', message: PHONE_MESSAGE })
    return z.NEVER
  })
}

/** Téléphone obligatoire d'une nouvelle saisie, rangé au format international. */
export function requiredPhone(label = 'Le téléphone') {
  return z.string({ error: `${label} est obligatoire` }).trim().min(1, `${label} est obligatoire`).pipe(checkPhone())
}

/** Téléphone facultatif d'une nouvelle saisie : vide ou absent devient null. */
export function optionalPhone() {
  return z.string().optional().nullable().transform((value) => value?.trim() || null).pipe(checkPhone().nullable())
}

/**
 * Téléphone d'une modification : rangé au format international s'il est reconnu, sinon gardé tel quel pour que la route
 * le compare à la valeur enregistrée (`assertChangedPhone`, R12).
 */
export function enteredPhone() {
  return z.string().optional().nullable().transform((value) => {
    const typed = value?.trim()
    return typed ? normalizePhone(typed) ?? typed : null
  })
}

/** Refuse un téléphone non reconnu, sauf s'il est celui déjà enregistré (R12). */
export function assertChangedPhone(path: string, value: string | null | undefined, saved: Array<string | null | undefined>) {
  if (value == null || normalizePhone(value) === value || saved.some((previous) => previous?.trim() === value)) return
  refuseField(path, [PHONE_MESSAGE])
}

/**
 * Contact d'urgence (R8) : nom et téléphone ensemble ; le message va sous le champ vide. Les deux vides passent : le
 * contact est facultatif là où cette règle s'applique seule.
 */
export function refineEmergencyContact(contact: { emergencyContactName?: string | null, emergencyContactPhone?: string | null }, ctx: z.RefinementCtx) {
  if (contact.emergencyContactName && !contact.emergencyContactPhone) {
    ctx.addIssue({ code: 'custom', path: ['emergencyContactPhone'], message: 'Le téléphone du contact d’urgence est obligatoire' })
  }
  if (contact.emergencyContactPhone && !contact.emergencyContactName) {
    ctx.addIssue({ code: 'custom', path: ['emergencyContactName'], message: 'Le nom du contact d’urgence est obligatoire' })
  }
}

/** Nom de personne facultatif : vide ou absent devient null. */
export function optionalPersonName(label = 'Le nom') {
  return z.string().optional().nullable()
    .transform((value) => value == null ? null : collapseSpaces(value) || null)
    .pipe(checkPersonName(label).nullable())
}
