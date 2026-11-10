// Adresses que lisent les pages d'un jeu, partagées entre ces pages et le téléchargement hors ligne (SPEC-019, ADR-0081) :
// une page qui lit une nouvelle adresse l'ajoute ici, et le téléchargement la garde aussi

// Listes : magasin de l'appareil et adresse ; les fiches relisent les mêmes adresses par le cache des réponses
export const LIST_READS = [
  ['games', '/api/games'],
  ['characters', '/api/characters'],
  ['factions', '/api/factions'],
  ['intrigues', '/api/intrigues'],
  ['items', '/api/items'],
  ['documents', '/api/documents'],
  ['timelineEvents', '/api/timeline-events'],
  ['participants', '/api/participants'],
  ['locations', '/api/locations'],
  ['sessions', '/api/sessions']
] as const

export const DASHBOARD_READ = '/api/dashboard'
export const AUTH_READ = '/api/auth/me'
export const REGISTRATION_PERIODS_READ = '/api/registration-periods'

type Sheet = { id: string, slug: string }
type GameSheet = Sheet & { gameId: string }

export const gameSheetRead = (slug: string) => `/api/games/slug/${slug}` as const
// Le jeu par son identifiant : un titre changé change le slug, pas l'identifiant gardé par l'appareil
export const gameRead = (id: string) => `/api/games/${id}` as const

// Fiches du contenu d'un jeu, lues par leur slug (conventions-api)
export const sheetReads = {
  faction: (slug: string) => `/api/factions/slug/${slug}` as const,
  intrigue: (slug: string) => `/api/intrigues/slug/${slug}` as const,
  item: (slug: string) => `/api/items/slug/${slug}` as const,
  document: (slug: string) => `/api/documents/slug/${slug}` as const,
  timelineEvent: (slug: string) => `/api/timeline-events/slug/${slug}` as const,
  location: (slug: string) => `/api/locations/slug/${slug}` as const
}

// Fiche d'un personnage : ses listes du jeu (relations, US-097), ses relations et son trombinoscope
export const characterReads = {
  sheet: (slug: string) => `/api/characters/slug/${slug}` as const,
  gameQuery: (gameId: string) => `?gameId=${gameId}` as const,
  relations: (id: string) => `/api/characters/${id}/relations` as const,
  trombinoscope: (id: string) => `/api/characters/${id}/trombinoscope` as const
}

export function characterPlan(character: GameSheet) {
  const query = characterReads.gameQuery(character.gameId)
  return [
    characterReads.sheet(character.slug),
    `/api/factions${query}`,
    `/api/intrigues${query}`,
    `/api/characters${query}`,
    characterReads.relations(character.id),
    characterReads.trombinoscope(character.id)
  ]
}

// Fiche d'un participant : ses sessions, et son contact d'urgence et ses allergies, que seul le téléchargement garde
// (ADR-0080)
export const participantReads = {
  sheet: (slug: string) => `/api/participants/slug/${slug}` as const,
  sessions: (id: string) => `/api/participants/${id}/sessions` as const,
  emergency: (id: string) => `/api/participants/${id}/emergency` as const
}

export const participantPlan = (participant: Sheet) => [
  participantReads.sheet(participant.slug),
  participantReads.sessions(participant.id),
  participantReads.emergency(participant.id)
]

// Page d'une session et ses onglets
export const sessionReads = {
  sheet: (slug: string) => `/api/sessions/slug/${slug}` as const,
  timeline: (id: string) => `/api/sessions/${id}/timeline` as const,
  documents: (id: string) => `/api/sessions/${id}/documents` as const,
  payments: (id: string) => `/api/sessions/${id}/payments` as const,
  allergies: (id: string) => `/api/sessions/${id}/allergies` as const,
  attendance: (id: string) => `/api/sessions/${id}/attendance` as const,
  allergiesPdf: (id: string) => `/api/sessions/${id}/allergies/pdf` as const
}

export const sessionPlan = (session: Sheet) => [
  sessionReads.sheet(session.slug),
  sessionReads.timeline(session.id),
  sessionReads.documents(session.id),
  sessionReads.payments(session.id),
  sessionReads.allergies(session.id),
  sessionReads.attendance(session.id)
]

// Inscriptions d'une période : sa sélection, ses tirages, et chaque inscription (US-119, US-120)
export const registrationReads = {
  selection: (periodId: string) => `/api/registration-periods/${periodId}/selection` as const,
  draws: (periodId: string) => `/api/registration-periods/${periodId}/draws` as const,
  registrations: (periodId: string) => `/api/registration-periods/${periodId}/registrations` as const,
  registration: (id: string) => `/api/registrations/${id}` as const
}

// Fichiers d'une session à venir : PDF (trombinoscopes, fiches, fiche allergies) et photos du cast, relevés dans les
// réponses de la session et de ses documents
const FILE_PATTERN = /^\/api\/(sessions\/[^/]+\/(trombinoscopes\/|documents\/.+\/pdf|allergies\/pdf)|uploads\/session-assignment-photos\/)/

export function filesIn(value: unknown, found = new Set<string>()) {
  if (typeof value === 'string') {
    if (FILE_PATTERN.test(value)) found.add(value)
  } else if (Array.isArray(value)) {
    for (const item of value) filesIn(item, found)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) filesIn(item, found)
  }
  return found
}

// Session à venir : sans date, ou datée d'aujourd'hui ou plus tard
export function isUpcoming(session: { date?: string | Date | null }, now = new Date()) {
  if (!session.date) return true
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  return new Date(session.date).getTime() >= day.getTime()
}
