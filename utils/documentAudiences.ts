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

type AudienceDocument = {
  audiences?: readonly DocumentRole[] | null
  characters?: readonly unknown[] | null
  factions?: readonly unknown[] | null
}

/** Rôles cochés d'un document ; aucun pour un document sans `audiences` (ciblage manuel seul). */
export function documentRoles(document: Pick<AudienceDocument, 'audiences'>): DocumentRole[] {
  return [...(document.audiences ?? [])]
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
