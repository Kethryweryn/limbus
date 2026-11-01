import { prisma } from '~/server/utils/prisma'
import { publicAppUrl } from '~/server/utils/appUrl'
import { generateSessionTrombinoscopes } from '~/server/utils/trombinoscopes'
import { deleteUnusedUploads } from '~/server/utils/uploads'

// Photos des participants (US-108, US-109, ADR-0054) : purge à l'échéance du jeu, retrait et refus

/** Échéance des photos d'une session : sa date plus la durée du jeu ; sans date, aucune. */
export function photosExpireAt(session: { date: Date | null }, retentionMonths: number) {
  if (!session.date) return null
  const expires = new Date(session.date)
  expires.setUTCMonth(expires.getUTCMonth() + retentionMonths)
  return expires
}

// Pas de tâche planifiée : appelé à chaque connexion et avant chaque envoi, comme purgeExpiredCopies (ADR-0044)
export async function purgeExpiredPhotos(now = new Date()) {
  const sessions = await prisma.session.findMany({
    where: {
      date: { not: null, lt: now },
      OR: [{ assignments: { some: { photoUrl: { not: null } } } }, { trombinoscopes: { some: {} } }]
    },
    select: { id: true, date: true, game: { select: { photoRetentionMonths: true } } }
  })
  const expired = sessions
    .filter((session) => photosExpireAt(session, session.game.photoRetentionMonths)!.getTime() <= now.getTime())
    .map((session) => session.id)
  if (!expired.length) return 0

  const photoUrls = (await prisma.sessionAssignment.findMany({ where: { sessionId: { in: expired }, photoUrl: { not: null } }, select: { photoUrl: true } }))
    .map((assignment) => assignment.photoUrl)
  await prisma.$transaction([
    prisma.sessionAssignment.updateMany({ where: { sessionId: { in: expired }, photoUrl: { not: null } }, data: { photoUrl: null } }),
    prisma.sessionTrombinoscope.deleteMany({ where: { sessionId: { in: expired } } })
  ])
  await deleteUnusedUploads(photoUrls)
  return expired.length
}

/**
 * Refus de l'usage de sa photo (US-109) : posé, il efface les photos du cast de ces fiches, puis refait les
 * trombinoscopes déjà générés des sessions touchées ; levé, il permet de nouveau d'ajouter une photo.
 */
export async function setPhotoRefusal(participantIds: string[], refused: boolean) {
  if (!refused) {
    await prisma.participant.updateMany({ where: { id: { in: participantIds } }, data: { photoRefusedAt: null } })
    return { regenerated: 0 }
  }

  const assignments = await prisma.sessionAssignment.findMany({
    where: { participantId: { in: participantIds }, photoUrl: { not: null } },
    select: { sessionId: true, photoUrl: true }
  })
  await prisma.$transaction([
    prisma.participant.updateMany({ where: { id: { in: participantIds }, photoRefusedAt: null }, data: { photoRefusedAt: new Date() } }),
    prisma.sessionAssignment.updateMany({ where: { participantId: { in: participantIds }, photoUrl: { not: null } }, data: { photoUrl: null } })
  ])
  await deleteUnusedUploads(assignments.map((assignment) => assignment.photoUrl))

  // Les trombinoscopes des sessions où la personne joue (ou où sa photo figurait) sont refaits sans elle
  const roles = await prisma.sessionAssignment.findMany({ where: { participantId: { in: participantIds } }, select: { sessionId: true } })
  const sessionIds = [...new Set([...assignments, ...roles].map((row) => row.sessionId))]
  const withTrombinoscopes = await prisma.sessionTrombinoscope.findMany({ where: { sessionId: { in: sessionIds } }, distinct: ['sessionId'], select: { sessionId: true } })
  let regenerated = 0
  for (const { sessionId } of withTrombinoscopes) {
    try {
      await generateSessionTrombinoscopes(sessionId, publicAppUrl())
      regenerated++
    } catch (error) {
      console.error('[photos] trombinoscopes non refaits', { sessionId, error: (error as Error)?.message })
    }
  }
  return { regenerated }
}
