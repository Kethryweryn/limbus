import { REGISTRATION_PERIOD_STATES } from './domain'

type RegistrationPeriodState = typeof REGISTRATION_PERIOD_STATES[keyof typeof REGISTRATION_PERIOD_STATES]

// État réel d'une période d'inscription, calculé à la lecture (ADR-0020) : une période ouverte
// dont la date de clôture est passée est clôturée, sans tâche planifiée pour l'écrire en base.
export function effectivePeriodState(
  period: { state: string, closesAt?: Date | string | null },
  now: Date = new Date()
): RegistrationPeriodState {
  if (period.state === REGISTRATION_PERIOD_STATES.closed) return REGISTRATION_PERIOD_STATES.closed
  if (period.state === REGISTRATION_PERIOD_STATES.draft) return REGISTRATION_PERIOD_STATES.draft

  const closesAt = period.closesAt ? new Date(period.closesAt) : null
  if (closesAt && closesAt.getTime() <= now.getTime()) return REGISTRATION_PERIOD_STATES.closed
  return REGISTRATION_PERIOD_STATES.open
}
