import type { H3Event } from 'h3'
import { z } from 'zod'
import { readZodBody } from '~/server/utils/schemas'
import { REGISTRATION_PERIOD_SCOPES, REGISTRATION_STATUSES, isClosedSessionStatus } from '~/utils/domain'

// Disponibilités demandées seulement pour une période de plusieurs sessions précises (R10)
export function asksAvailability(period: { scope: string, sessions: unknown[] }) {
  return period.scope === REGISTRATION_PERIOD_SCOPES.sessions && period.sessions.length > 1
}

export function availabilitySchema(period: { scope: string, sessions: Array<{ session: { id: string, status?: string } }> }) {
  if (!asksAvailability(period)) {
    return z.object({ availableSessionIds: z.unknown().optional().transform((): string[] => []) })
  }
  // Une session annulée ou terminée n'est plus proposée
  const ids = new Set(period.sessions.filter((link) => !isClosedSessionStatus(link.session.status)).map((link) => link.session.id))
  return z.object({
    availableSessionIds: z.array(z.string(), { error: 'Choisissez au moins une session où vous êtes disponible' })
      .min(1, 'Choisissez au moins une session où vous êtes disponible')
      .refine((values) => values.every((id) => ids.has(id)), 'Session inconnue pour cette période')
      .transform((values) => [...new Set(values)])
  })
}

// Disponibilités d'une inscription reçue qu'on modifie ; undefined (rien ne change) pour les autres
export async function readAvailability(event: H3Event, registration: { status: string, period: { scope: string, sessions: Array<{ session: { id: string, status?: string } }> } }) {
  if (registration.status !== REGISTRATION_STATUSES.received || !asksAvailability(registration.period)) return undefined
  return (await readZodBody(event, availabilitySchema(registration.period))).availableSessionIds
}
