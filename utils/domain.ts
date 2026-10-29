export const CHARACTER_TYPES = {
  pj: 'pj',
  pnj: 'pnj'
} as const

export const CHARACTER_TYPE_OPTIONS = [
  { label: 'PJ', value: CHARACTER_TYPES.pj },
  { label: 'PNJ', value: CHARACTER_TYPES.pnj }
]

export const SESSION_STATUSES = {
  scheduled: 'scheduled',
  postponed: 'postponed',
  cancelled: 'cancelled',
  completed: 'completed'
} as const

// Suivi du remboursement d'un paiement d'une session annulée ou reportée (US-023)
export const REFUND_STATUSES = {
  toRefund: 'to_refund',
  refunded: 'refunded',
  carriedOver: 'carried_over',
  // Personne partie (désistement, retrait) : paiement gardé, ou transféré au remplaçant (US-039, ADR-0033)
  kept: 'kept',
  transferred: 'transferred'
} as const

// Annulée ou terminée : hors du tableau de bord, des prochaines sessions et de la section « à venir » (US-020)
export const CLOSED_SESSION_STATUSES: string[] = [SESSION_STATUSES.cancelled, SESSION_STATUSES.completed]

export function isClosedSessionStatus(status: string | null | undefined) {
  return CLOSED_SESSION_STATUSES.includes(status ?? '')
}

export const SESSION_STATUS_OPTIONS = [
  { label: 'Prévue', value: SESSION_STATUSES.scheduled },
  { label: 'Reportée', value: SESSION_STATUSES.postponed },
  { label: 'Annulée', value: SESSION_STATUSES.cancelled },
  { label: 'Terminée', value: SESSION_STATUSES.completed }
]

export const SESSION_STATUS_META = {
  [SESSION_STATUSES.scheduled]: { label: 'Prévue', color: 'primary' },
  [SESSION_STATUSES.postponed]: { label: 'Reportée', color: 'warning' },
  [SESSION_STATUSES.cancelled]: { label: 'Annulée', color: 'error' },
  [SESSION_STATUSES.completed]: { label: 'Terminée', color: 'success' }
} as const

export const SESSION_ROLES = {
  participant: 'participant',
  organizer: 'organizer',
  npc: 'npc',
  kitchen: 'kitchen'
} as const

export const SESSION_ROLE_LABELS = {
  [SESSION_ROLES.organizer]: 'Orga',
  [SESSION_ROLES.npc]: 'PNJ',
  [SESSION_ROLES.kitchen]: 'Cuisine',
  [SESSION_ROLES.participant]: 'Participant'
} as const

export const DOCUMENT_AUDIENCES = {
  targeted: 'targeted',
  everyone: 'everyone',
  organizers: 'organizers',
  npcs: 'npcs',
  kitchen: 'kitchen'
} as const

export const DOCUMENT_AUDIENCE_OPTIONS = [
  { label: 'Ciblage manuel', value: DOCUMENT_AUDIENCES.targeted },
  { label: 'Tout le monde', value: DOCUMENT_AUDIENCES.everyone },
  { label: 'Organisateurs', value: DOCUMENT_AUDIENCES.organizers },
  { label: 'PNJs', value: DOCUMENT_AUDIENCES.npcs },
  { label: 'Équipe cuisine', value: DOCUMENT_AUDIENCES.kitchen }
]

export const DOCUMENT_AUDIENCE_LABELS = Object.fromEntries(
  DOCUMENT_AUDIENCE_OPTIONS.map((option) => [option.value, option.label])
) as Record<string, string>

export const INTRIGUE_LEVELS = {
  mainStory: 'main_story',
  mainCharacter: 'main_character',
  major: 'major',
  minor: 'minor'
} as const

export const INTRIGUE_LEVEL_OPTIONS = [
  { label: 'Trame principale scénario', value: INTRIGUE_LEVELS.mainStory },
  { label: 'Trame principale personnage', value: INTRIGUE_LEVELS.mainCharacter },
  { label: 'Intrigue majeure', value: INTRIGUE_LEVELS.major },
  { label: 'Intrigue mineure', value: INTRIGUE_LEVELS.minor }
]

export const VIRTUAL_CHARACTER_GROUPS = {
  allPj: '__all_pj__',
  allPnj: '__all_pnj__',
  allCharacters: '__all_characters__'
} as const

export const VIRTUAL_CHARACTER_GROUP_OPTIONS = [
  { label: 'Tous les PJs', value: VIRTUAL_CHARACTER_GROUPS.allPj },
  { label: 'Tous les PNJs', value: VIRTUAL_CHARACTER_GROUPS.allPnj },
  { label: 'Tous les participants', value: VIRTUAL_CHARACTER_GROUPS.allCharacters }
]

// Seul rôle global : administratrice ou non (ADR-0038)
// jusqu'à la conversion des données
export const USER_ROLES = {
  admin: 'admin',
  user: 'user'
} as const

export const USER_ROLE_OPTIONS = [
  { label: 'Administratrice', value: USER_ROLES.admin },
  { label: 'Compte', value: USER_ROLES.user }
]

export const GAME_SHARE_ROLES = {
  organizer: 'organizer'
} as const

export const GAME_INVITATION_STATUSES = {
  pending: 'pending',
  accepted: 'accepted',
  revoked: 'revoked'
} as const

// Co-organisation d'un jeu, ou legs d'une copie à une personne sans compte (SPEC-002 R8, ADR-0025)
export const GAME_INVITATION_KINDS = {
  share: 'share',
  bequest: 'bequest'
} as const

// Périodes d'inscription (SPEC-001)
export const REGISTRATION_PERIOD_SCOPES = {
  sessions: 'sessions',
  game: 'game'
} as const

export const REGISTRATION_ENTRY_MODES = {
  invitation: 'invitation',
  form: 'form'
} as const

export const REGISTRATION_SELECTION_MODES = {
  random: 'random',
  chosen: 'chosen',
  mixed: 'mixed'
} as const

export const REGISTRATION_PERIOD_STATES = {
  draft: 'draft',
  open: 'open',
  closed: 'closed'
} as const

export const REGISTRATION_PERIOD_STATE_META = {
  [REGISTRATION_PERIOD_STATES.draft]: { label: 'Brouillon', color: 'neutral' },
  [REGISTRATION_PERIOD_STATES.open]: { label: 'Ouverte', color: 'success' },
  [REGISTRATION_PERIOD_STATES.closed]: { label: 'Clôturée', color: 'warning' }
} as const

export const REGISTRATION_DEFAULT_RESPONSE_DELAY_DAYS = 7

// Statuts d'une inscription (R16). Le mode invitation n'utilise que ceux-ci ; les suivants arrivent avec la sélection.
export const REGISTRATION_STATUSES = {
  invited: 'invited',
  confirmed: 'confirmed',
  withdrawn: 'withdrawn'
} as const

export const REGISTRATION_STATUS_META = {
  [REGISTRATION_STATUSES.invited]: { label: 'Invitée', color: 'info' },
  [REGISTRATION_STATUSES.confirmed]: { label: 'Confirmée', color: 'success' },
  [REGISTRATION_STATUSES.withdrawn]: { label: 'Désistée', color: 'neutral' }
} as const

export const REGISTRATION_SOURCES = {
  invitation: 'invitation',
  form: 'form'
} as const
