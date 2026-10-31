import { prisma } from '~/server/utils/prisma'
import { deleteUnusedUploads } from '~/server/utils/uploads'
import { NO_COPY } from '~/server/utils/deliveryCopies'
import { normalizeRegistrationFormDefinition, type RegistrationFormDefinition } from '~/utils/registrationForms'

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
 * ne révèle pas leurs jeux.
 */
export async function exportParticipantData(participantId: string, gameIds: string[] | null) {
  const inGames = gameIds === null ? {} : { gameId: { in: gameIds } }
  const inSessions = gameIds === null ? {} : { session: { gameId: { in: gameIds } } }
  const session = { select: { name: true, date: true, game: { select: { title: true } } } }
  const inPeriods = gameIds === null ? {} : { period: { gameId: { in: gameIds } } }

  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: {
      name: true,
      email: true,
      phone: true,
      userId: true,
      updatedAt: true,
      gameLinks: { where: inGames, select: { createdAt: true, notes: true, game: { select: { title: true } } } },
      sessionRoles: { where: inSessions, select: { role: true, session } },
      assignments: { where: inSessions, select: { photoUrl: true, notes: true, character: { select: { name: true } }, session } },
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
          formVersion: { select: { definition: true } },
          // Sessions où la personne s'est dite disponible (R10)
          availabilities: { select: { session: { select: { name: true, date: true } } } },
          affinities: { select: { kind: true, text: true }, orderBy: { position: 'asc' } },
          invitationSentAt: true,
          lastRemindedAt: true,
          responseDueAt: true,
          respondedAt: true,
          confirmedAt: true,
          withdrawnAt: true,
          // Qui a invité ou retiré la personne : le droit d'accès porte sur toutes ses données (US-037)
          invitedBy: { select: { name: true } },
          withdrawnBy: { select: { name: true } },
          createdAt: true,
          period: { select: { name: true, game: { select: { title: true } } } },
          session: { select: { name: true, date: true } }
        }
      }
    }
  })

  const { gameLinks, userId, documentDeliveries, registrations, ...rest } = participant
  return {
    exportedAt: new Date().toISOString(),
    ...rest,
    // Réponses aux questions avec leur libellé, lu dans la version remplie (US-081)
    registrations: registrations.map(({ questionAnswers, formVersion, ...registration }) => ({
      ...registration,
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
