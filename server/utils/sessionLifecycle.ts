import { prisma } from '~/server/utils/prisma'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { assertSessionLocation } from '~/server/utils/sessionAssignments'
import { SESSION_STATUSES } from '~/utils/domain'

// Seule une session prévue ou annulée se reporte (US-022) ; une session reportée l'est déjà
export const POSTPONABLE_SESSION_STATUSES: string[] = [SESSION_STATUSES.scheduled, SESSION_STATUSES.cancelled]

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Reporte une session sur une nouvelle session du même jeu (US-022, ADR-0029) : l'équipe et le casting
 * (notes et photos comprises) sont recopiés, et l'ancienne session passe « Reportée » en pointant vers la
 * nouvelle. Les photos recopiées servent aux deux sessions : leur fichier est rattaché au jeu, pour que
 * supprimer l'une des sessions ne l'emporte pas.
 */
export async function postponeSession(sessionId: string, target: { name: string, date?: string | null, locationId?: string | null }) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { participants: true, assignments: true }
  })
  if (!POSTPONABLE_SESSION_STATUSES.includes(session.status)) {
    throw createError({ statusCode: 409, message: 'Seule une session prévue ou annulée peut être reportée.' })
  }
  await assertSessionLocation(session.gameId, target.locationId)

  const slug = await generateUniqueSlug('session', target.name)
  const photoUrls = [...new Set(session.assignments.map((assignment) => assignment.photoUrl).filter((url): url is string => Boolean(url)))]

  return await prisma.$transaction(async (tx) => {
    const created = await tx.session.create({
      data: {
        name: target.name,
        slug,
        gameId: session.gameId,
        date: parseDate(target.date),
        locationId: target.locationId || null,
        status: SESSION_STATUSES.scheduled,
        participants: {
          create: session.participants.map((participant) => ({ participantId: participant.participantId, role: participant.role }))
        },
        assignments: {
          create: session.assignments.map((assignment) => ({
            characterId: assignment.characterId,
            participantId: assignment.participantId,
            photoUrl: assignment.photoUrl,
            notes: assignment.notes
          }))
        }
      },
      select: { id: true, slug: true, name: true }
    })

    // Conditionnel : deux reports simultanés de la même session ne passent pas tous les deux
    const updated = await tx.session.updateMany({
      where: { id: session.id, status: { in: POSTPONABLE_SESSION_STATUSES }, postponedToSessionId: null },
      data: { status: SESSION_STATUSES.postponed, postponedToSessionId: created.id }
    })
    if (!updated.count) {
      throw createError({ statusCode: 409, message: 'Cette session vient d’être reportée ou modifiée : rechargez la page.' })
    }

    if (photoUrls.length) {
      await tx.uploadedFile.updateMany({
        where: { url: { in: photoUrls }, sessionId: session.id },
        data: { sessionId: null, gameId: session.gameId }
      })
    }

    return created
  })
}
