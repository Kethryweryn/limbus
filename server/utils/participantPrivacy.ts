import { unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { prisma } from '~/server/utils/prisma'

const PHOTO_URL_PREFIX = '/api/uploads/session-assignment-photos/'

function photoPath(url: string) {
  return join(process.cwd(), '.data', 'uploads', 'session-assignment-photos', basename(url))
}

/**
 * Efface un participant et tout ce qui le concerne (RGPD, droit à l'effacement) :
 * ses liens aux jeux et sessions, ses paiements et envois, et ses photos, fichiers compris.
 * Les trombinoscopes générés des sessions où figurait sa photo sont supprimés : ils l'incluent
 * et devront être régénérés. Les assignations sont conservées, sans participant ni photo.
 */
export async function eraseParticipant(participantId: string) {
  const assignments = await prisma.sessionAssignment.findMany({
    where: { participantId },
    select: { sessionId: true, photoUrl: true }
  })
  const photoUrls = [...new Set(assignments.map((assignment) => assignment.photoUrl).filter((url): url is string => Boolean(url)))]
  const sessionsWithPhoto = [...new Set(assignments.filter((assignment) => assignment.photoUrl).map((assignment) => assignment.sessionId))]

  const orphanPhotoUrls = await prisma.$transaction(async (tx) => {
    await tx.sessionAssignment.updateMany({
      where: { participantId },
      data: { participantId: null, photoUrl: null }
    })
    if (sessionsWithPhoto.length) {
      await tx.sessionTrombinoscope.deleteMany({ where: { sessionId: { in: sessionsWithPhoto } } })
    }
    await tx.participant.delete({ where: { id: participantId } })

    // Une photo encore utilisée ailleurs (autre assignation, photo de personnage) est gardée
    const stillUsed = new Set([
      ...(await tx.sessionAssignment.findMany({
        where: { photoUrl: { in: photoUrls } },
        select: { photoUrl: true }
      })).map((row) => row.photoUrl),
      ...(await tx.character.findMany({
        where: { trombinoscopePhotoUrl: { in: photoUrls } },
        select: { trombinoscopePhotoUrl: true }
      })).map((row) => row.trombinoscopePhotoUrl)
    ])
    const orphans = photoUrls.filter((url) => !stillUsed.has(url))
    await tx.uploadedFile.deleteMany({ where: { url: { in: orphans } } })
    return orphans
  })

  // Fichiers supprimés après la transaction : en cas d'échec de la base, rien n'est perdu
  for (const url of orphanPhotoUrls) {
    if (!url.startsWith(PHOTO_URL_PREFIX)) continue
    await unlink(photoPath(url)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }

  return { deletedPhotos: orphanPhotoUrls.length }
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

  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    select: {
      name: true,
      email: true,
      phone: true,
      notes: true,
      updatedAt: true,
      gameLinks: { where: inGames, select: { createdAt: true, game: { select: { title: true } } } },
      sessionRoles: { where: inSessions, select: { role: true, session } },
      assignments: { where: inSessions, select: { photoUrl: true, notes: true, character: { select: { name: true } }, session } },
      payments: { where: inSessions, select: { paidAt: true, paymentEmailSentAt: true, paymentReminderSentAt: true, session } },
      documentDeliveries: { where: inSessions, select: { kind: true, sentAt: true, document: { select: { title: true } }, character: { select: { name: true } }, session } },
      timelineResponsibilities: { where: inSessions, select: { timelineEvent: { select: { name: true, day: true, time: true } }, session } },
      trombinoscopes: { where: inSessions, select: { generatedAt: true, viewerCharacter: { select: { name: true } }, session } }
    }
  })

  const { gameLinks, ...rest } = participant
  return {
    exportedAt: new Date().toISOString(),
    ...rest,
    games: gameLinks.map((link) => ({ title: link.game.title, registeredAt: link.createdAt }))
  }
}
