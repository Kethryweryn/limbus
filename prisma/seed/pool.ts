// Tout joueur d'une session vient du vivier (R31 de SPEC-018, ADR-0069) : les joueurs des jeux de test y ont leur réponse
// et leur place, comme après une vraie confirmation. Le jeu sans autre vivier en reçoit un fermé : son lien répond
// « inscriptions closes ». Une réponse porte sa version du questionnaire : c'est elle qui lui fait suivre le compte.
import { DEFAULT_REGISTRATION_FORM_DEFINITION } from '../../utils/registrationForms'
import { splitParticipantName } from '../../utils/registrations'
import { REGISTRATION_ANSWERS, REGISTRATION_SESSION_STATUSES as LINE, REGISTRATION_SOURCES, REGISTRATION_STATUSES, REGISTRATION_PERIOD_STATES, SESSION_ROLES, SESSION_STATUSES } from '../../utils/domain'
import type { Db } from './db'
import { daysFromNow } from './options'

// Une session dont une décision est annoncée a son annonce : ses changements se proposent ligne par ligne (R27)
async function markAnnouncedSessions(db: Db, gameId: string) {
  const lines = await db.registrationSession.findMany({
    where: { announcedStatus: { not: null }, registration: { period: { gameId } } },
    distinct: ['sessionId'],
    select: { sessionId: true }
  })
  await db.registrationPeriodSession.updateMany({ where: { sessionId: { in: lines.map((line) => line.sessionId) } }, data: { castAnnouncedAt: daysFromNow(-5) } })
}

export async function placePlayersInPool(db: Db, gameId: string) {
  const players = await db.sessionParticipant.findMany({
    where: { role: SESSION_ROLES.participant, session: { gameId } },
    select: {
      sessionId: true,
      session: { select: { status: true } },
      participant: {
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          // Ses coordonnées et ses allergies sont celles de son compte, comme après une vraie réponse
          user: { select: { phone: true, emergencyContactName: true, emergencyContactPhone: true, dietary: true, healthConsentAt: true } }
        }
      }
    }
  })
  if (!players.length) return

  const { id: periodId } = await db.registrationPeriod.upsert({
    where: { gameId },
    update: {},
    create: { gameId, publicId: `essai-${gameId}`, state: REGISTRATION_PERIOD_STATES.closed, notifyTeam: false },
    select: { id: true }
  })
  const { versions: [version] } = await db.registrationForm.upsert({
    where: { gameId },
    update: {},
    create: { gameId, versions: { create: { number: 1, definition: DEFAULT_REGISTRATION_FORM_DEFINITION as object } } },
    select: { versions: { orderBy: { number: 'desc' }, take: 1, select: { id: true } } }
  })
  for (const { sessionId, session, participant } of players) {
    const { id: registrationId, status } = await db.registration.upsert({
      where: { periodId_participantId: { periodId, participantId: participant.id } },
      update: {},
      create: {
        periodId,
        participantId: participant.id,
        status: REGISTRATION_STATUSES.received,
        source: REGISTRATION_SOURCES.form,
        formVersionId: version!.id,
        email: participant.email ?? `${participant.slug}@example.test`,
        ...splitParticipantName(participant.name),
        phone: participant.user?.phone ?? participant.phone,
        // Toujours demandé (US-181) : sans compte, un proche fictif
        emergencyContactName: participant.user?.emergencyContactName ?? `Proche de ${splitParticipantName(participant.name).firstName || participant.name}`,
        emergencyContactPhone: participant.user?.emergencyContactPhone ?? '07 00 00 03 00',
        dietary: participant.user?.dietary,
        healthConsentAt: participant.user?.healthConsentAt,
        charterAcceptedAt: daysFromNow(-90),
        respondedAt: daysFromNow(-90)
      },
      select: { id: true, status: true }
    })
    // Sorti du vivier ou seulement invité : son histoire reste celle que le jeu raconte
    if (status !== REGISTRATION_STATUSES.received) continue
    await db.registrationPeriodSession.upsert({ where: { sessionId }, update: {}, create: { periodId, sessionId } })
    const line = session.status === SESSION_STATUSES.postponed ? LINE.transferred : LINE.confirmed
    await db.registrationSession.upsert({
      where: { registrationId_sessionId: { registrationId, sessionId } },
      update: {},
      create: { registrationId, sessionId, status: line, answer: REGISTRATION_ANSWERS.available, announcedStatus: LINE.retained, confirmedAt: daysFromNow(-60) }
    })
  }
  await markAnnouncedSessions(db, gameId)
}
