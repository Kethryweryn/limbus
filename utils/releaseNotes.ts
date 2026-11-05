// Notes de la page « Nouveautés » (SPEC-017, ADR-0065)
export const RELEASE_NOTE_TYPES = ['nouveau', 'modifie', 'corrige', 'retire'] as const

export type ReleaseNoteType = typeof RELEASE_NOTE_TYPES[number]

export const RELEASE_NOTE_TYPE_LABELS: Record<ReleaseNoteType, string> = {
  nouveau: 'Nouveau',
  modifie: 'Modifié',
  corrige: 'Corrigé',
  retire: 'Retiré'
}

export type ReleaseNote = {
  type: ReleaseNoteType
  titre: string
  texte: string
  /** Moment de la fusion, en ISO 8601 */
  at: string
}

export type ReleaseNotesData = {
  notes: ReleaseNote[]
  deployNumber: number | null
}
