import {
  REGISTRATION_ANSWERS,
  REGISTRATION_SELECTION_STATUSES,
  REGISTRATION_SESSION_STATUSES,
  REGISTRATION_SESSION_STATUS_META,
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_META,
  type RegistrationSessionStatus
} from './domain'

type DateLike = Date | string | null | undefined

// Réponse portée par le lien d'une demande de disponibilités (R11) : la page demande de la confirmer
export const AVAILABILITY_ANSWER_PARAMS = { available: 'disponible', unavailable: 'indisponible' } as const

// Invitation sans réponse, ou place retenue pas encore confirmée, dont l'échéance est passée (R20 de SPEC-001),
// calculé à la lecture (ADR-0020). Une place retenue n'a d'échéance qu'une fois annoncée (ADR-0047).
export function isResponseOverdue(
  item: { status: string, responseDueAt?: DateLike },
  now: Date = new Date()
) {
  return (item.status === REGISTRATION_STATUSES.invited || item.status === REGISTRATION_SESSION_STATUSES.retained)
    && Boolean(item.responseDueAt)
    && new Date(item.responseDueAt!).getTime() < now.getTime()
}

// Statut montré aux orgas (US-005) : « délai dépassé » n'est pas stocké, il se lit sur l'échéance (ADR-0020)
export const REGISTRATION_OVERDUE = 'overdue'

export const REGISTRATION_DISPLAY_STATUS_META: Record<string, { label: string, color: 'info' | 'success' | 'neutral' | 'warning' | 'primary' }> = {
  ...REGISTRATION_STATUS_META,
  ...REGISTRATION_SESSION_STATUS_META,
  [REGISTRATION_OVERDUE]: { label: 'Délai dépassé', color: 'warning' }
}

export function registrationDisplayStatus(
  item: { status: string, responseDueAt?: DateLike },
  now: Date = new Date()
) {
  return isResponseOverdue(item, now) ? REGISTRATION_OVERDUE : item.status
}

// « Délai dépassé » se lit sur l'échéance (R20, ADR-0020) ; un statut inconnu s'affiche tel quel
export function registrationStatusMeta(item: { status: string, responseDueAt?: DateLike, validated?: boolean }) {
  return REGISTRATION_DISPLAY_STATUS_META[item.validated ? 'validated' : registrationDisplayStatus(item)] || { label: item.status, color: 'neutral' as const }
}

type LineLike = { status: RegistrationSessionStatus, announcedStatus?: RegistrationSessionStatus | null, ignoredStatus?: RegistrationSessionStatus | null, cancelledById?: string | null }

export const ANNOUNCEMENT_REMOVED = 'removed' as const

// Une place ou une liste d'attente qui lui a été annoncée
const wasAnnounced = (line: LineLike) => Boolean(line.announcedStatus && REGISTRATION_SELECTION_STATUSES.includes(line.announcedStatus))

/**
 * Ce qu'il y a à dire à la personne pour une session (R27) : une décision différente de ce qui lui a été annoncé, ou le
 * retrait de ce qui lui a été annoncé. Rien à une personne jamais prévenue, à qui a confirmé, à qui s'est retirée
 * elle-même, ni quand l'équipe a écarté cet email pour ce statut.
 */
export function pendingAnnouncement(line: LineLike) {
  if (line.ignoredStatus === line.status) return null
  if (REGISTRATION_SELECTION_STATUSES.includes(line.status)) return line.announcedStatus === line.status ? null : line.status
  if (!wasAnnounced(line) || line.status === REGISTRATION_SESSION_STATUSES.confirmed || line.status === REGISTRATION_SESSION_STATUSES.transferred) return null
  if (line.status === REGISTRATION_SESSION_STATUSES.cancelled && !line.cancelledById) return null
  return ANNOUNCEMENT_REMOVED
}

export function isAnnouncementPending(line: LineLike) {
  return pendingAnnouncement(line) !== null
}

// Place retenue et annoncée : la personne peut la confirmer (US-089)
export function canConfirmPlace(line: LineLike) {
  return line.status === REGISTRATION_SESSION_STATUSES.retained && line.announcedStatus === REGISTRATION_SESSION_STATUSES.retained
}

// Ce que dit la dernière réponse de la personne ; null si elle n'a jamais répondu pour cette session
function answeredStatus(line: { answer?: string | null }) {
  if (line.answer === REGISTRATION_ANSWERS.available) return REGISTRATION_SESSION_STATUSES.preregistered
  if (line.answer === REGISTRATION_ANSWERS.unavailable) return REGISTRATION_SESSION_STATUSES.unavailable
  return null
}

/**
 * Statut que voit la personne pour une session (R28, ADR-0047) : ce qui lui a été annoncé, sinon sa dernière réponse ;
 * null si elle n'a rien à voir. Une décision pas encore annoncée ne se voit jamais, ni un retrait que l'équipe ne lui a
 * pas encore écrit. Une personne qui a confirmé sa place apprend son annulation aussitôt.
 */
export function visibleLineStatus(line: LineLike & { answer?: string | null, cancelledById?: string | null, confirmedAt?: Date | string | null }) {
  if (REGISTRATION_SELECTION_STATUSES.includes(line.status)) return wasAnnounced(line) ? line.announcedStatus! : answeredStatus(line)
  const byTeam = line.status === REGISTRATION_SESSION_STATUSES.cancelled && Boolean(line.cancelledById)
  if (byTeam && line.confirmedAt) return line.status
  if (wasAnnounced(line) && (byTeam || line.status === REGISTRATION_SESSION_STATUSES.preregistered || line.status === REGISTRATION_SESSION_STATUSES.unavailable)) return line.announcedStatus!
  if (byTeam && !line.announcedStatus) return answeredStatus(line)
  return line.status
}

// Préremplissage du formulaire à partir du nom de la fiche : « Prénom Nom » ; la personne corrige au besoin
export function splitParticipantName(name: string) {
  const [firstName = '', ...rest] = name.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') }
}

/** Onglets de la page Inscriptions d'un jeu (SPEC-020, R4), dans l'adresse sous `onglet` (R5). */
export const REGISTRATION_TABS = ['sessions', 'vivier', 'reglages'] as const
export type RegistrationTab = typeof REGISTRATION_TABS[number]
