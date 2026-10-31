import { REGISTRATION_STATUSES } from './domain'

const DAY_MS = 24 * 60 * 60 * 1000

// Le lien personnel cesse de fonctionner 30 jours après la dernière session de la période (ADR-0018)
export const REGISTRATION_LINK_GRACE_DAYS = 30

type DateLike = Date | string | null | undefined

// Invitation sans réponse dont l'échéance est passée (R20), calculé à la lecture (ADR-0020)
export function isInvitationOverdue(
  registration: { status: string, responseDueAt?: DateLike },
  now: Date = new Date()
) {
  return registration.status === REGISTRATION_STATUSES.invited
    && Boolean(registration.responseDueAt)
    && new Date(registration.responseDueAt!).getTime() < now.getTime()
}

// Statut montré aux orgas (US-005) : « délai dépassé » n'est pas stocké, il se lit sur l'échéance (ADR-0020)
export const REGISTRATION_OVERDUE = 'overdue'

export const REGISTRATION_DISPLAY_STATUS_META: Record<string, { label: string, color: 'info' | 'success' | 'neutral' | 'warning' }> = {
  [REGISTRATION_STATUSES.invited]: { label: 'Invitée', color: 'info' },
  [REGISTRATION_STATUSES.received]: { label: 'Reçue', color: 'info' },
  [REGISTRATION_OVERDUE]: { label: 'Délai dépassé', color: 'warning' },
  [REGISTRATION_STATUSES.confirmed]: { label: 'Confirmée', color: 'success' },
  [REGISTRATION_STATUSES.withdrawn]: { label: 'Désistée', color: 'neutral' }
}

export function registrationDisplayStatus(
  registration: { status: string, responseDueAt?: DateLike },
  now: Date = new Date()
) {
  return isInvitationOverdue(registration, now) ? REGISTRATION_OVERDUE : registration.status
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
