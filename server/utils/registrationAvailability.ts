import { z } from 'zod'
import type { PrismaTx } from '~/server/utils/prisma'
import { REGISTRATION_ANSWERS, REGISTRATION_SESSION_STATUSES as LINE } from '~/utils/domain'
import { canConfirmPlace } from '~/utils/registrations'

// Sessions cochées par la personne (R7) : parmi celles qu'on lui propose, et aucune si elle veut. Champ absent : rien ne change
export function availabilitySchema(sessionIds: string[]) {
  const ids = new Set(sessionIds)
  return z.object({
    availableSessionIds: z.array(z.string(), { error: 'Disponibilités invalides' })
      .refine((values) => values.every((id) => ids.has(id)), 'Cette session n’est plus proposée : rechargez la page.')
      .transform((values) => [...new Set(values)])
      .optional()
  })
}

export type AvailabilityEffect = 'none' | 'changed' | 'kept' | 'removed'

/**
 * Réponse d'une personne pour une session (R11, R29) :
 * - « Disponible » rend pré-inscrite une personne sans réponse, pas disponible ou en annulation, sans lui rendre son
 *   rang ni sa place ; pour les autres, rien ne change ;
 * - « Pas disponible » : pré-inscrite, elle passe à « pas disponible » ; en attente, elle sort de la file ; retenue sans
 *   annonce, elle est retirée du cast et son personnage redevient libre (effet « removed » : l'équipe est prévenue) ;
 *   retenue et annoncée, inscrite ou transférée, rien ne change (effet « kept » : la page renvoie vers l'annulation).
 */
export async function answerAvailability(tx: PrismaTx, registration: { id: string, gameId: string }, sessionId: string, available: boolean, now = new Date()): Promise<AvailabilityEffect> {
  const registrationId = registration.id
  const key = { registrationId_sessionId: { registrationId, sessionId } }
  const line = await tx.registrationSession.findUnique({ where: key, select: { status: true, announcedStatus: true } })
  const answer = available ? REGISTRATION_ANSWERS.available : REGISTRATION_ANSWERS.unavailable
  const answered = { answer, answeredAt: now }

  if (!line) {
    await tx.registrationSession.create({
      data: { gameId: registration.gameId, registrationId, sessionId, status: available ? LINE.preregistered : LINE.unavailable, ...answered }
    })
    return 'changed'
  }

  if (available) {
    const comesBack = line.status === LINE.unavailable || line.status === LINE.cancelled
    await tx.registrationSession.update({
      where: key,
      data: {
        ...answered,
        // Revenue, elle repart sans ce qui lui avait été annoncé : c'est une nouvelle pré-inscription
        ...(comesBack
          ? { status: LINE.preregistered, cancelledAt: null, cancelledById: null, announcedStatus: null, announcedAt: null, responseDueAt: null, lastRemindedAt: null }
          : {})
      }
    })
    return comesBack ? 'changed' : 'none'
  }

  if (line.status === LINE.confirmed || line.status === LINE.transferred || canConfirmPlace(line)) return 'kept'
  if (line.status === LINE.unavailable || line.status === LINE.cancelled) {
    await tx.registrationSession.update({ where: key, data: answered })
    return 'none'
  }
  const removed = line.status === LINE.retained
  await tx.registrationSession.update({
    where: key,
    // Sortie par sa propre réponse : il n'y a plus rien à lui annoncer (R27)
    data: { ...answered, status: LINE.unavailable, waitlistPosition: null, retainedById: null, announcedStatus: null, announcedAt: null, ignoredStatus: null }
  })
  if (removed) {
    await tx.sessionAssignment.updateMany({ where: { sessionId, reservedRegistrationId: registrationId }, data: { reservedRegistrationId: null } })
  }
  return removed ? 'removed' : 'changed'
}
