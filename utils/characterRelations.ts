// Relations entre personnages (US-097, ADR-0050) et relations refusées par un inscrit (US-099)

export const CHARACTER_RELATION_TYPES = [
  { value: 'romance', label: 'Romance' },
  { value: 'family', label: 'Famille' },
  { value: 'rivalry', label: 'Rivalité' },
  { value: 'alliance', label: 'Alliance' },
  { value: 'hierarchy', label: 'Hiérarchie' },
  { value: 'other', label: 'Autre' }
] as const

export type CharacterRelationType = typeof CHARACTER_RELATION_TYPES[number]['value']
export const CHARACTER_RELATION_TYPE_VALUES = CHARACTER_RELATION_TYPES.map(({ value }) => value) as [CharacterRelationType, ...CharacterRelationType[]]
export const CHARACTER_RELATION_LABEL_MAX_LENGTH = 100
export const CHARACTER_RELATION_DESCRIPTION_MAX_LENGTH = 2000

export const characterRelationTypeLabel = (type: string) => CHARACTER_RELATION_TYPES.find((entry) => entry.value === type)?.label ?? type

// Cases de « Les relations que je ne veux pas jouer » : les types, sauf « Autre », et « Aucune, tout me va »
export const REFUSED_RELATION_NONE = 'none'
export const REFUSED_RELATION_CHOICES = [
  ...CHARACTER_RELATION_TYPES.filter(({ value }) => value !== 'other'),
  { value: REFUSED_RELATION_NONE, label: 'Aucune, tout me va' }
] as const
export const REFUSED_RELATION_VALUES = REFUSED_RELATION_CHOICES.map(({ value }) => value) as [string, ...string[]]

export const refusedRelationLabel = (value: string) => REFUSED_RELATION_CHOICES.find((entry) => entry.value === value)?.label ?? value

type RelationRow = {
  id: string
  type: string
  description: string | null
  fromCharacterId: string
  fromLabel: string | null
  fromVisible: boolean
  toCharacterId: string
  toLabel: string | null
  toVisible: boolean
  fromCharacter?: { id: string, name: string }
  toCharacter?: { id: string, name: string }
}

/** Une relation vue d'un de ses personnages : l'autre personnage, son propre libellé, et si elle lui est visible. */
export function relationSide<T extends RelationRow>(relation: T, characterId: string) {
  const mine = relation.fromCharacterId === characterId
  return {
    relation,
    other: mine ? relation.toCharacter : relation.fromCharacter,
    label: mine ? relation.fromLabel : relation.toLabel,
    otherLabel: mine ? relation.toLabel : relation.fromLabel,
    visible: mine ? relation.fromVisible : relation.toVisible
  }
}

/** Ligne de la fiche personnage : « Bran — Famille, demi-sœur de : brouillés depuis la guerre ». */
export function relationSheetLine(relation: RelationRow, characterId: string) {
  const side = relationSide(relation, characterId)
  const kind = [characterRelationTypeLabel(relation.type), side.label].filter(Boolean).join(', ')
  return `${side.other?.name ?? '?'} — ${kind}${relation.description ? ` : ${relation.description}` : ''}`
}
