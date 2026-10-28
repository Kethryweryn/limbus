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
