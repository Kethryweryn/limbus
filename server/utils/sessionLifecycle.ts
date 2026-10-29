import { prisma } from '~/server/utils/prisma'
import { openEmailTransport, sendEmail } from '~/server/utils/email'
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

async function assertCancelled(sessionId: string) {
  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: { status: true } })
  if (session.status !== SESSION_STATUSES.cancelled) {
    throw createError({ statusCode: 409, message: 'L’email d’annulation ne s’envoie que pour une session annulée.' })
  }
}

/**
 * Email d'annulation, relu par l'organisation, à toute l'équipe de la session (US-025) : une fois par
 * personne qui a un email, sur une seule connexion SMTP. Un échec n'arrête pas les autres.
 */
export async function sendCancellationEmail(sessionId: string, message: { subject: string, text: string }) {
  await assertCancelled(sessionId)
  const members = await prisma.sessionParticipant.findMany({
    where: { sessionId },
    select: { participant: { select: { id: true, name: true, email: true } } }
  })
  const people = [...new Map(members.map((member) => [member.participant.id, member.participant])).values()]
  const recipients = people.filter((person) => person.email)
  const withoutEmail = people.filter((person) => !person.email).map((person) => person.name)
  if (!recipients.length) return { sentCount: 0, withoutEmail, failures: [] as string[] }

  const transport = await openEmailTransport().catch(() => null)
  if (!transport) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé ou mal configuré' })
  }
  let sentCount = 0
  const failures: string[] = []
  try {
    for (const person of recipients) {
      try {
        await transport.send({ to: person.email!, subject: message.subject, text: message.text })
        sentCount++
      } catch {
        failures.push(person.name)
      }
    }
  } finally {
    transport.close()
  }
  if (!sentCount) {
    throw createError({ statusCode: 502, message: `Aucun email d’annulation n’est parti (${failures.join(', ')}).` })
  }
  return { sentCount, withoutEmail, failures }
}

export async function sendCancellationTestEmail(sessionId: string, message: { subject: string, text: string, emails: string[] }) {
  await assertCancelled(sessionId)
  const result = await sendEmail({ to: message.emails, subject: `[Test] ${message.subject}`, text: message.text })
  if (!result.sent) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé' })
  }
  return { sentCount: message.emails.length }
}
