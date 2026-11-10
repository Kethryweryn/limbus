import {
  metaOf,
  REGISTRATION_ANSWERS,
  REGISTRATION_PERIOD_STATE_META,
  REGISTRATION_SEAT_STATUSES,
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

/** Badge de l'état d'un vivier ; un état inconnu se lit comme un brouillon. */
export const periodStateMeta = (state: string) => metaOf(REGISTRATION_PERIOD_STATE_META, state) ?? REGISTRATION_PERIOD_STATE_META.draft

/** Personnes dans le vivier : celles qui ont répondu ; une invitation sans réponse n'y est pas encore (R4). */
export const poolOf = <T extends { status: string }>(registrations: T[]) =>
  registrations.filter((registration) => registration.status === REGISTRATION_STATUSES.received)

/** Onglets de la page Inscriptions d'un jeu (SPEC-020, R4), dans l'adresse sous `onglet` (R5). */
export const REGISTRATION_TABS = ['sessions', 'vivier', 'reglages'] as const
export type RegistrationTab = typeof REGISTRATION_TABS[number]

/** Ce qui reste à traiter dans une session (SPEC-020, R2). */
export type ToHandle = { answersChanged: number, awaitingReply: number, castToAnnounce: number }
type HandledLine = LineLike & { sessionId: string, answersChangedAt?: string | Date | null }
type HandledSession = { id: string, castAnnouncedAt?: string | Date | null }

/**
 * Ce qui reste à traiter dans chaque session prévue donnée, pour les personnes du vivier : réponses modifiées non lues
 * d'une personne placée (celles qui ont « Marquer comme lu »),
 * réponses attendues (place retenue et annoncée, pas encore confirmée), et casting à annoncer (jamais annoncé avec une
 * personne retenue, ou annoncé avec des changements à proposer).
 */
export function toHandleBySession(registrations: Array<{ status: string, sessionLines: HandledLine[] }>, sessions: HandledSession[]) {
  // Lignes groupées par session en un passage
  const bySession = new Map<string, HandledLine[]>()
  for (const line of poolOf(registrations).flatMap((registration) => registration.sessionLines)) {
    bySession.set(line.sessionId, [...(bySession.get(line.sessionId) ?? []), line])
  }
  return new Map(sessions.map((session) => {
    const own = bySession.get(session.id) ?? []
    const toAnnounce = session.castAnnouncedAt
      ? own.some(isAnnouncementPending)
      : own.some((line) => line.status === REGISTRATION_SESSION_STATUSES.retained)
    return [session.id, {
      answersChanged: own.filter((line) => line.answersChangedAt && REGISTRATION_SEAT_STATUSES.includes(line.status)).length,
      awaitingReply: own.filter(canConfirmPlace).length,
      castToAnnounce: toAnnounce ? 1 : 0
    } satisfies ToHandle]
  }))
}

/** Somme de ce qui reste à traiter dans plusieurs sessions. */
export const sumToHandle = (counts: Iterable<ToHandle>) => [...counts].reduce<ToHandle>((total, count) => ({
  answersChanged: total.answersChanged + count.answersChanged,
  awaitingReply: total.awaitingReply + count.awaitingReply,
  castToAnnounce: total.castToAnnounce + count.castToAnnounce
}), { answersChanged: 0, awaitingReply: 0, castToAnnounce: 0 })

const countLabel = (count: number, singular: string, plural: string) => `${count} ${count > 1 ? plural : singular}`

/** « 2 réponses modifiées · 1 réponse attendue · 1 casting à annoncer », sans les nombres nuls ; vide sans rien à traiter. */
export function toHandleText(count: ToHandle) {
  return [
    count.answersChanged ? countLabel(count.answersChanged, 'réponse modifiée', 'réponses modifiées') : '',
    count.awaitingReply ? countLabel(count.awaitingReply, 'réponse attendue', 'réponses attendues') : '',
    count.castToAnnounce ? countLabel(count.castToAnnounce, 'casting à annoncer', 'castings à annoncer') : ''
  ].filter(Boolean).join(' · ')
}
