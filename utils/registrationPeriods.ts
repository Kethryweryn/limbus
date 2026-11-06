import { SESSION_STATUSES } from './domain'

export const startOfDay = (date: Date) => {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

// Une session se propose au vivier seulement datée, à venir, ni annulée ni terminée (R6) : vérifié à chaque lecture (ADR-0020)
export function isOpenableSession(session: { date: Date | string | null, status: string }, now: Date = new Date()) {
  return session.status === SESSION_STATUSES.scheduled
    && Boolean(session.date)
    && new Date(session.date!).getTime() >= startOfDay(now).getTime()
}

// Une session encore à venir, datée ou non (R4)
export function isUpcomingSession(session: { date: Date | string | null, status: string }, now: Date = new Date()) {
  return session.status === SESSION_STATUSES.scheduled && (!session.date || new Date(session.date).getTime() >= startOfDay(now).getTime())
}

// Condition Prisma équivalente à isOpenableSession, pour une liste de sessions
export function openableSessionWhere(now: Date = new Date()) {
  return { status: SESSION_STATUSES.scheduled, date: { gte: startOfDay(now) } }
}
