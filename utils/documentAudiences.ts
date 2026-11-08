import { DOCUMENT_AUDIENCES } from '~/utils/domain'

// Public d'un document (US-187, ADR-0072) : des rôles cochés, plus une sélection avancée de personnages et de groupes

export const DOCUMENT_ROLES = {
  organizers: 'organizers',
  npcs: 'npcs',
  kitchen: 'kitchen',
  pjs: 'pjs'
} as const

export type DocumentRole = typeof DOCUMENT_ROLES[keyof typeof DOCUMENT_ROLES]

// Dans l'ordre des cases du formulaire
export const DOCUMENT_ROLE_OPTIONS: ReadonlyArray<{ value: DocumentRole, label: string }> = [
  { value: DOCUMENT_ROLES.organizers, label: 'Organisateurs' },
  { value: DOCUMENT_ROLES.npcs, label: 'PNJ' },
  { value: DOCUMENT_ROLES.kitchen, label: 'Cuisine' },
  { value: DOCUMENT_ROLES.pjs, label: 'PJ' }
]

export const ALL_DOCUMENT_ROLES: DocumentRole[] = DOCUMENT_ROLE_OPTIONS.map((option) => option.value)

// « Tout le monde » n'est pas stocké : c'est les quatre cases cochées
export const isEveryone = (roles: readonly string[]) => ALL_DOCUMENT_ROLES.every((role) => roles.includes(role))

const LEGACY_SINGLE_ROLES: readonly string[] = [DOCUMENT_ROLES.organizers, DOCUMENT_ROLES.npcs, DOCUMENT_ROLES.kitchen]

/** Rôles d'un ancien public unique (`Document.audience`), pour une écriture d'avant ADR-0072. */
export function rolesFromLegacyAudience(audience: string | null | undefined): DocumentRole[] {
  if (audience === DOCUMENT_AUDIENCES.everyone) return [...ALL_DOCUMENT_ROLES]
  return audience && LEGACY_SINGLE_ROLES.includes(audience) ? [audience as DocumentRole] : []
}

/** Ancien public le plus proche des rôles, écrit pour le build encore en service pendant un déploiement (ADR-0024). */
export function legacyAudience(roles: readonly string[]): string {
  if (isEveryone(roles)) return DOCUMENT_AUDIENCES.everyone
  const [only] = roles
  return roles.length === 1 && only && LEGACY_SINGLE_ROLES.includes(only) ? only : DOCUMENT_AUDIENCES.targeted
}

type AudienceDocument = {
  audiences?: readonly string[] | null
  audience?: string | null
  characters?: readonly unknown[] | null
  factions?: readonly unknown[] | null
}

/**
 * Rôles d'un document : `audiences`, sinon ceux de l'ancien public. Couvre un document gardé sur l'appareil avant ADR-0072
 * (sans `audiences`) et un document écrit par le build encore en service pendant le déploiement (`audiences` vide).
 * L'application écrit toujours dans `audience` l'ancien public le plus proche des rôles : sans rôle, c'est le ciblage
 * manuel, qui n'en donne aucun.
 */
export function documentRoles(document: Pick<AudienceDocument, 'audiences' | 'audience'>): string[] {
  return document.audiences?.length ? [...document.audiences] : rolesFromLegacyAudience(document.audience)
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

/** Libellé court : « Tout le monde », ou les rôles cochés, puis la sélection avancée ; « Non ciblé » sans rien. */
export function documentAudienceLabel(document: AudienceDocument) {
  const audiences = documentRoles(document)
  const roles = isEveryone(audiences)
    ? ['Tout le monde']
    : DOCUMENT_ROLE_OPTIONS.filter((option) => audiences.includes(option.value)).map((option) => option.label)
  const characters = document.characters?.length ?? 0
  const factions = document.factions?.length ?? 0
  const selection = [characters ? plural(characters, 'personnage') : null, factions ? plural(factions, 'groupe') : null].filter(Boolean)
  return [...roles, ...selection].join(' · ') || 'Non ciblé'
}

export const isDocumentTargeted = (document: AudienceDocument) =>
  documentRoles(document).length > 0 || Boolean(document.characters?.length || document.factions?.length)
