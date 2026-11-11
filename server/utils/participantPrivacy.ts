import { labelNestedSessions } from '~/server/utils/sessionLabels'
import { prisma } from '~/server/utils/prisma'
import { deleteUnusedUploads } from '~/server/utils/uploads'
import { NO_COPY } from '~/server/utils/deliveryCopies'
import { REGISTRATION_SESSION_STATUSES as LINE, type RegistrationSessionStatus } from '~/utils/domain'
import { normalizeRegistrationFormDefinition, type RegistrationFormDefinition } from '~/utils/registrationForms'
import { visibleLineStatus } from '~/utils/registrations'
import { latestOf, withGameValues } from '~/server/utils/participantValues'

type ExportedLine = {
  status: RegistrationSessionStatus
  answer: string | null
  announcedStatus: RegistrationSessionStatus | null
  waitlistPosition: number | null
  responseDueAt: Date | null
  cancelledAt: Date | null
  cancelledById: string | null
  cancelledBy: { name: string } | null
  retainedBy: { name: string } | null
  answersChangedAt: Date | null
}

// La personne lit dans son export ce que montre sa page : une décision pas encore annoncée n'y figure pas (R28,
// ADR-0069). L'export demandé à l'équipe garde tout
function lineForPerson<T extends ExportedLine>({ cancelledById, retainedBy: _retainedBy, answersChangedAt: _changed, ...line }: T) {
  const status = visibleLineStatus({ ...line, cancelledById })
  if (!status) return []
  const cancelled = status === LINE.cancelled
  return [{
    ...line,
    status,
    waitlistPosition: status === LINE.waitlisted ? line.waitlistPosition : null,
    responseDueAt: status === LINE.retained ? line.responseDueAt : null,
    cancelledAt: cancelled ? line.cancelledAt : null,
    cancelledBy: cancelled ? line.cancelledBy : null
  }]
}

/**
 * Efface ce qu'une équipe tient d'une fiche suivie aussi par d'autres (SPEC-022 R14, US-241) : dans ses seuls jeux, ses
 * liens, inscriptions (contacts, allergies, affinités), rôles et présences de session, paiements, envois,
 * trombinoscopes, responsabilités du déroulé, et les photos du cast, fichiers compris. Les affinités d'autres personnes
 * qui la désignent dans ces jeux partent aussi, comme à l'effacement complet. La fiche et ce que tiennent les autres
 * équipes restent ; sans autre équipe, l'effacement est complet (`eraseParticipant`).
 */
export async function eraseParticipantForTeam(participantId: string, gameIds: string[] | null) {
  const others = gameIds === null ? 0 : await prisma.participantGame.count({ where: { participantId, gameId: { notIn: gameIds } } })
  if (!others) return await eraseParticipant(participantId)

  const inGames = { participantId, gameId: { in: gameIds! } }
  const inSessions = { participantId, session: { gameId: { in: gameIds! } } }
  const assignments = await prisma.sessionAssignment.findMany({ where: inGames, select: { sessionId: true, photoUrl: true } })
  const photoUrls = assignments.map((assignment) => assignment.photoUrl)
  const sessionsWithPhoto = [...new Set(assignments.filter((assignment) => assignment.photoUrl).map((assignment) => assignment.sessionId))]

  await prisma.$transaction(async (tx) => {
    await tx.sessionAssignment.updateMany({ where: inGames, data: { participantId: null, photoUrl: null } })
    if (sessionsWithPhoto.length) {
      await tx.sessionTrombinoscope.deleteMany({ where: { sessionId: { in: sessionsWithPhoto } } })
      await tx.sessionDocumentDelivery.updateMany({ where: { sessionId: { in: sessionsWithPhoto }, kind: 'trombinoscope', copySize: { not: null } }, data: NO_COPY })
    }
    await tx.registrationAffinity.deleteMany({ where: { targetParticipantId: participantId, registration: { gameId: { in: gameIds! } } } })
    await tx.sessionPayment.updateMany({ where: { transferredToParticipantId: participantId, gameId: { in: gameIds! } }, data: { transferredToParticipantId: null } })
    await tx.registration.deleteMany({ where: inGames })
    await tx.sessionPayment.deleteMany({ where: inGames })
    await tx.sessionDocumentDelivery.deleteMany({ where: inGames })
    await tx.sessionTrombinoscope.deleteMany({ where: inGames })
    await tx.timelineEventResponsible.deleteMany({ where: inGames })
    await tx.sessionAttendance.deleteMany({ where: inSessions })
    await tx.sessionParticipant.deleteMany({ where: inSessions })
    await tx.participantGame.deleteMany({ where: inGames })
  })
  return { deletedPhotos: await deleteUnusedUploads(photoUrls) }
}

/**
 * Efface un participant et tout ce qui le concerne (RGPD, droit à l'effacement) :
 * ses liens aux jeux et sessions, ses inscriptions, ses paiements et envois, ses confirmations de présence,
 * et ses photos, fichiers compris.
 * Les inscriptions (contacts, allergies) partent avec le participant, par cascade.
 * Les trombinoscopes générés des sessions où figurait sa photo sont supprimés : ils l'incluent
 * et devront être régénérés ; les copies envoyées de ces trombinoscopes aussi (ADR-0044).
 * Les assignations sont conservées, sans participant ni photo.
 */
export async function eraseParticipant(participantId: string) {
  const assignments = await prisma.sessionAssignment.findMany({
    where: { participantId },
    select: { sessionId: true, photoUrl: true }
  })
  const photoUrls = assignments.map((assignment) => assignment.photoUrl)
  const sessionsWithPhoto = [...new Set(assignments.filter((assignment) => assignment.photoUrl).map((assignment) => assignment.sessionId))]

  await prisma.$transaction(async (tx) => {
    await tx.sessionAssignment.updateMany({
      where: { participantId },
      data: { participantId: null, photoUrl: null }
    })
    if (sessionsWithPhoto.length) {
      await tx.sessionTrombinoscope.deleteMany({ where: { sessionId: { in: sessionsWithPhoto } } })
      await tx.sessionDocumentDelivery.updateMany({ where: { sessionId: { in: sessionsWithPhoto }, kind: 'trombinoscope', copySize: { not: null } }, data: NO_COPY })
    }
    await tx.participant.delete({ where: { id: participantId } })
  })

  // Une photo encore utilisée ailleurs (autre assignation, photo de personnage) est gardée
  return { deletedPhotos: await deleteUnusedUploads(photoUrls) }
}

/**
 * Données d'un participant (RGPD, droit d'accès), limitées aux jeux accessibles
 * à l'organisateur qui exporte : un participant inscrit chez d'autres organisateurs
 * ne révèle pas leurs jeux. Exporté par la personne elle-même (`forPerson`), il ne contient pas les rattachements
 * de ses affinités, que seule l'équipe voit (R24, ADR-0049).
 */
/** Nom, téléphone et dates d'une fiche tels que les voit une équipe : ceux de ses liens (SPEC-022 R5, R6). */
function teamView(links: Array<{ name: string | null, phone: string | null, createdAt: Date, updatedAt: Date }>, fiche: { name: string, phone: string | null, createdAt: Date, updatedAt: Date }) {
  const latest = [...links].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0]
  return {
    name: latest?.name ?? fiche.name,
    phone: latest ? latest.phone : fiche.phone,
    // Création : l'entrée de la fiche dans les jeux de l'équipe, pas sa création par une autre
    createdAt: links.length ? new Date(Math.min(...links.map((link) => link.createdAt.getTime()))) : fiche.createdAt,
    updatedAt: latestOf(links.map((link) => link.updatedAt)) ?? fiche.updatedAt
  }
}

export async function exportParticipantData(participantId: string, gameIds: string[] | null, { forPerson = false } = {}) {
  const inGames = gameIds === null ? {} : { gameId: { in: gameIds } }
  const inSessions = gameIds === null ? {} : { session: { gameId: { in: gameIds } } }
  // Avec son identifiant, le temps d'y ajouter son libellé (SPEC-021) ; l'export ne le garde pas
  const session = { select: { id: true, date: true, game: { select: { title: true } } } }
  const inPeriods = gameIds === null ? {} : { period: { gameId: { in: gameIds } } }

  const participant = await labelNestedSessions(prisma, await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: {
      name: true,
      email: true,
      phone: true,
      userId: true,
      // Refus de l'usage de sa photo (US-109)
      photoRefusedAt: true,
      createdAt: true,
      updatedAt: true,
      gameLinks: { where: inGames, select: { createdAt: true, updatedAt: true, notes: true, name: true, phone: true, game: { select: { title: true } } } },
      sessionRoles: { where: inSessions, select: { role: true, createdAt: true, session } },
      assignments: { where: inSessions, select: { photoUrl: true, notes: true, createdAt: true, character: { select: { name: true } }, session } },
      payments: { where: inSessions, select: { paidAt: true, paymentEmailSentAt: true, paymentReminderSentAt: true, refundStatus: true, refundedAt: true, tariff: { select: { name: true, amountCents: true } }, instalments: { select: { amountCents: true, receivedAt: true } }, session } },
      documentDeliveries: { where: inSessions, select: { kind: true, sentAt: true, copyContent: true, document: { select: { title: true } }, character: { select: { name: true } }, session } },
      timelineResponsibilities: { where: inSessions, select: { timelineEvent: { select: { name: true, day: true, time: true } }, session } },
      trombinoscopes: { where: inSessions, select: { generatedAt: true, viewerCharacter: { select: { name: true } }, session } },
      attendances: { where: inSessions, select: { status: true, responseDueAt: true, invitationSentAt: true, lastRemindedAt: true, respondedAt: true, session } },
      registrations: {
        where: inPeriods,
        select: {
          status: true,
          source: true,
          email: true,
          firstName: true,
          lastName: true,
          facebookName: true,
          phone: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          dietary: true,
          healthConsentAt: true,
          charterAcceptedAt: true,
          // Réponses aux questions et affinités (US-081, US-082)
          questionAnswers: true,
          // Réponse à la question d'équilibre (US-091)
          balancePreference: true,
          formVersion: { select: { definition: true } },
          // Statut et disponibilité de la personne pour chaque session (SPEC-018)
          sessionLines: { select: { status: true, answer: true, answeredAt: true, lastRemindedAt: true, responseDueAt: true, waitlistPosition: true, announcedStatus: true, announcedAt: true, confirmedAt: true, cancelledAt: true, cancelledById: true, cancelledBy: { select: { name: true } }, retainedBy: { select: { name: true } }, answersChangedAt: true, session: { select: { id: true, date: true } } } },
          // Affinités écrites par la personne, avec la personne rattachée ; jamais celles des autres qui la visent (US-095)
          affinities: {
            select: { kind: true, text: true, ...(forPerson ? {} : { targetUnknown: true, targetParticipant: { select: { id: true, name: true } } }) },
            orderBy: { position: 'asc' }
          },
          invitationSentAt: true,
          lastRemindedAt: true,
          responseDueAt: true,
          respondedAt: true,
          withdrawnAt: true,
          // Qui a invité ou retiré la personne : le droit d'accès porte sur toutes ses données (US-037)
          invitedBy: { select: { name: true } },
          withdrawnBy: { select: { name: true } },
          createdAt: true,
          // Jeu de l'inscription : les personnes de ses affinités y sont nommées comme les tient son équipe (ADR-0086)
          gameId: true,
          invitedSession: { select: { id: true, date: true } },
          period: { select: { game: { select: { title: true } } } }
        }
      }
    }
  }), { dropId: true })

  await withGameValues(participant.registrations)
  const { gameLinks, userId, documentDeliveries, registrations, ...rest } = participant
  return {
    exportedAt: new Date().toISOString(),
    ...rest,
    // Exportée par une équipe : son nom, son téléphone et ses dates, rien d'une autre équipe qui suit la fiche (ADR-0086)
    ...(gameIds === null ? {} : teamView(gameLinks, rest)),
    // Réponses aux questions avec leur libellé, lu dans la version remplie (US-081)
    registrations: registrations.map(({ questionAnswers, formVersion, sessionLines, gameId: _gameId, ...registration }) => ({
      ...registration,
      // La personne rattachée, par son nom seulement : l'identifiant ne servait qu'à la nommer comme son équipe
      affinities: registration.affinities.map(({ targetParticipant, ...affinity }) => targetParticipant === undefined ? affinity : { ...affinity, targetParticipant: targetParticipant && { name: targetParticipant.name } }),
      sessionLines: forPerson ? sessionLines.flatMap(lineForPerson) : sessionLines.map(({ cancelledById: _author, ...line }) => line),
      questionAnswers: formVersion
        ? normalizeRegistrationFormDefinition(formVersion.definition as RegistrationFormDefinition).questions
          .filter((question) => (questionAnswers as Record<string, unknown> | null)?.[question.id] !== undefined)
          .map((question) => ({ question: question.label, answer: (questionAnswers as Record<string, unknown>)[question.id] }))
        : []
    })),
    // Texte des copies reçues (ADR-0044) ; pas celles des trombinoscopes, qui montrent d'autres personnes
    documentDeliveries: documentDeliveries.map(({ copyContent, ...delivery }) => ({
      ...delivery,
      copy: delivery.kind === 'trombinoscope' ? null : copyContent
    })),
    // Fiche rattachée au compte Limbus de la personne (US-070, ADR-0041)
    linkedToAccount: Boolean(userId),
    // Notes de chaque jeu exporté (US-069)
    games: gameLinks.map((link) => ({ title: link.game.title, registeredAt: link.createdAt, notes: link.notes }))
  }
}
