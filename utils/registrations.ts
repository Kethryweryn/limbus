import { CLOSED_SESSION_STATUSES, REGISTRATION_SELECTION_STATUSES, REGISTRATION_STATUSES } from './domain'

const DAY_MS = 24 * 60 * 60 * 1000

// Le lien personnel cesse de fonctionner 30 jours après la dernière session de la période (ADR-0018)
export const REGISTRATION_LINK_GRACE_DAYS = 30

type DateLike = Date | string | null | undefined

// Invitation sans réponse, ou place retenue pas encore confirmée, dont l'échéance est passée (R20),
// calculé à la lecture (ADR-0020). Une place retenue n'a d'échéance qu'une fois annoncée (ADR-0047).
export function isResponseOverdue(
  registration: { status: string, responseDueAt?: DateLike },
  now: Date = new Date()
) {
  return (registration.status === REGISTRATION_STATUSES.invited || registration.status === REGISTRATION_STATUSES.retained)
    && Boolean(registration.responseDueAt)
    && new Date(registration.responseDueAt!).getTime() < now.getTime()
}

// Statut montré aux orgas (US-005) : « délai dépassé » n'est pas stocké, il se lit sur l'échéance (ADR-0020)
export const REGISTRATION_OVERDUE = 'overdue'

export const REGISTRATION_DISPLAY_STATUS_META: Record<string, { label: string, color: 'info' | 'success' | 'neutral' | 'warning' | 'primary' }> = {
  [REGISTRATION_STATUSES.invited]: { label: 'Invitée', color: 'info' },
  [REGISTRATION_STATUSES.received]: { label: 'Reçue', color: 'info' },
  [REGISTRATION_STATUSES.retained]: { label: 'Retenue', color: 'primary' },
  [REGISTRATION_STATUSES.waitlisted]: { label: 'Liste d’attente', color: 'warning' },
  [REGISTRATION_STATUSES.rejected]: { label: 'Non retenue', color: 'neutral' },
  [REGISTRATION_OVERDUE]: { label: 'Délai dépassé', color: 'warning' },
  [REGISTRATION_STATUSES.confirmed]: { label: 'Confirmée', color: 'success' },
  [REGISTRATION_STATUSES.withdrawn]: { label: 'Désistée', color: 'neutral' }
}

export function registrationDisplayStatus(
  registration: { status: string, responseDueAt?: DateLike },
  now: Date = new Date()
) {
  return isResponseOverdue(registration, now) ? REGISTRATION_OVERDUE : registration.status
}

type AnnouncedLike = { status: string, sessionId?: string | null, announcedStatus?: string | null, announcedSessionId?: string | null }

// Décision de la sélection qui diffère de ce qui a été annoncé à la personne (US-088, ADR-0047) ;
// une place retenue changée de session est à annoncer à nouveau
export function isAnnouncementPending(registration: AnnouncedLike) {
  if (!REGISTRATION_SELECTION_STATUSES.includes(registration.status)) return false
  if (registration.announcedStatus !== registration.status) return true
  return registration.status === REGISTRATION_STATUSES.retained && registration.announcedSessionId !== registration.sessionId
}

// Place retenue annoncée dans sa session : la personne peut la confirmer (US-089)
export function canConfirmPlace(registration: { status: string, sessionId: string | null, announcedStatus: string | null, announcedSessionId: string | null }) {
  return registration.status === REGISTRATION_STATUSES.retained
    && Boolean(registration.sessionId)
    && registration.announcedStatus === REGISTRATION_STATUSES.retained
    && registration.announcedSessionId === registration.sessionId
}

/**
 * Vivier de l'inscription permanente (R30, ADR-0047), calculé à la lecture : une inscription retenue ou confirmée
 * pour une session depuis annulée, terminée ou supprimée y est de nouveau.
 */
export function isBackInPool(registration: { status: string, session?: { status: string } | null }) {
  return (registration.status === REGISTRATION_STATUSES.retained || registration.status === REGISTRATION_STATUSES.confirmed)
    && (!registration.session || CLOSED_SESSION_STATUSES.includes(registration.session.status))
}

// Statut que voit la personne : une décision pas encore annoncée ne se voit pas (ADR-0047)
export function announcedRegistrationStatus(registration: AnnouncedLike) {
  if (!isAnnouncementPending(registration)) return registration.status
  return registration.announcedStatus && REGISTRATION_SELECTION_STATUSES.includes(registration.announcedStatus)
    ? registration.announcedStatus
    : REGISTRATION_STATUSES.received
}

// Compteur par statut d'une session, dans l'ordre d'affichage, sans les statuts absents
export function countRegistrationsByStatus(registrations: Array<{ status: string, responseDueAt?: DateLike }>, now: Date = new Date()) {
  const counts = new Map<string, number>()
  for (const registration of registrations) {
    const status = registrationDisplayStatus(registration, now)
    counts.set(status, (counts.get(status) || 0) + 1)
  }
  return Object.keys(REGISTRATION_DISPLAY_STATUS_META)
    .filter((status) => counts.has(status))
    .map((status) => ({ status, count: counts.get(status)!, ...REGISTRATION_DISPLAY_STATUS_META[status]! }))
}

// Sans date de session connue, le lien n'expire pas : il reste révocable par renvoi ou suppression
export function registrationLinkExpired(sessionDates: DateLike[], now: Date = new Date()) {
  const times = sessionDates.filter(Boolean).map((date) => new Date(date!).getTime())
  if (!times.length) return false
  return now.getTime() > Math.max(...times) + REGISTRATION_LINK_GRACE_DAYS * DAY_MS
}

// Préremplissage du formulaire à partir du nom de la fiche : « Prénom Nom » ; la personne corrige au besoin
export function splitParticipantName(name: string) {
  const [firstName = '', ...rest] = name.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') }
}
