import { z } from 'zod'

// Règles de saisie communes aux routes, au questionnaire et aux outils des assistants (SPEC-023, ADR-0092) : une règle
// s'écrit ici, une seule fois

export const PERSON_NAME_MAX_LENGTH = 100

// Nom de personne (R1) : lettres de tout alphabet (accents compris), espace, trait d'union, apostrophe, point ; au moins
// une lettre, à n'importe quelle place (« 't Hooft »)
const PERSON_NAME_PATTERN = /^(?=.*\p{L})[\p{L}\p{M} '’.-]+$/u

export const tooLong = (label: string, max: number) => `${label} : ${max} caractères au plus`
export const personNameMessage = (label: string) =>
  `${label} ne peut contenir que des lettres, des espaces, des traits d’union, des apostrophes et des points`

// Espaces en double ou aux extrémités retirés : « Jean   Martin » devient « Jean Martin »
const collapseSpaces = (value: string) => value.replace(/\s+/g, ' ').trim()

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

/** Nom de personne facultatif : vide ou absent devient null. */
export function optionalPersonName(label = 'Le nom') {
  return z.string().optional().nullable()
    .transform((value) => value == null ? null : collapseSpaces(value) || null)
    .pipe(checkPersonName(label).nullable())
}
