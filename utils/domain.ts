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

export const USER_ROLES = {
  admin: 'admin',
  organizer: 'organizer'
} as const

export const USER_ROLE_OPTIONS = [
  { label: 'Administrateur', value: USER_ROLES.admin },
  { label: 'Organisateur', value: USER_ROLES.organizer }
]

export const GAME_SHARE_ROLES = {
  organizer: 'organizer'
} as const
