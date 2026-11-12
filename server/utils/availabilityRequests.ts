import { prisma } from '~/server/utils/prisma'
import { openEmailTransport } from '~/server/utils/email'
import { findSelectionPeriod, replayerParticipantIds, selectableSessions } from '~/server/utils/registrationSelection'
import { availabilityRequestEmail, createRegistrationToken, registrationUrl } from '~/server/utils/registrations'
import { REGISTRATION_REPLAY_POLICIES, REGISTRATION_STATUSES, SESSION_CAST_ROLES } from '~/utils/domain'
import { withGameValues } from '~/server/utils/participantValues'

/**
 * Demande de disponibilités (R9) et relance (R12) : écrit aux personnes du vivier sans ligne pour cette session, donc sans
 * réponse ni place, et qui n'y tiennent pas déjà un rôle. Une personne invitée n'a pas encore répondu au questionnaire,
 * une personne sortie n'y est plus, et une rejoueuse exclue ne reçoit rien (R24). Chaque email parti a son lien
 * (ADR-0070). `registrationIds` limite l'envoi : réessayer après un échec n'écrit pas de nouveau aux autres. Rien ne part
 * sans le clic d'une organisatrice.
 */
export async function sendAvailabilityRequest(periodId: string, sessionId: string, registrationIds?: string[]) {
  const period = (await findSelectionPeriod(periodId))!
  const session = (await selectableSessions(period)).find((candidate) => candidate.id === sessionId)
  if (!session) {
    throw createError({ statusCode: 400, message: 'Session invalide pour ce vivier' })
  }
  if (!session.offered) {
    throw createError({ statusCode: 409, message: 'Ouvrez d’abord cette session à la pré-inscription.' })
  }

  const people = await prisma.registration.findMany({
    where: {
      periodId,
      status: REGISTRATION_STATUSES.received,
      sessionLines: { none: { sessionId } },
      participant: { sessionRoles: { none: { sessionId, role: { in: SESSION_CAST_ROLES } } } },
      ...(registrationIds ? { id: { in: registrationIds } } : {})
    },
    orderBy: { createdAt: 'asc' },
    // Jeu et fiche : le nom est celui qu'en tient l'équipe du jeu (ADR-0086)
    select: { id: true, email: true, participantId: true, gameId: true, participant: { select: { id: true } } }
  }).then(withGameValues)
  const excluded = period.replayPolicy === REGISTRATION_REPLAY_POLICIES.excluded
    ? await replayerParticipantIds(period.gameId, people.map((person) => person.participantId))
    : new Set<string>()

  const reminder = Boolean(session.lastRequestedAt)
  const failures: Array<{ registrationId: string, participantName: string, message: string | null }> = []
  let sentCount = 0
  const transport = await openEmailTransport().catch(() => null)
  try {
    for (const person of people) {
      if (excluded.has(person.participantId)) continue
      const participantName = person.participant.name
      if (!transport) {
        failures.push({ registrationId: person.id, participantName, message: 'SMTP désactivé' })
        continue
      }
      // Le lien existe avant l'email : un email parti ne porte jamais un lien mort ; sans envoi, il disparaît
      const { token, tokenHash } = createRegistrationToken()
      const link = await prisma.registrationLink.create({ data: { registrationId: person.id, tokenHash }, select: { id: true } })
      try {
        await transport.send({
          to: person.email,
          accountFooter: true,
          ...availabilityRequestEmail({ participantName, gameTitle: period.game.title, session, url: registrationUrl(token), reminder })
        })
        sentCount++
      } catch (error) {
        await prisma.registrationLink.delete({ where: { id: link.id } })
        failures.push({ registrationId: person.id, participantName, message: (error as { message?: string })?.message || 'Erreur SMTP' })
      }
    }
  } finally {
    transport?.close()
  }

  if (sentCount) await prisma.registrationPeriodSession.update({ where: { sessionId }, data: { lastRequestedAt: new Date() } })
  return { sentCount, failures }
}
