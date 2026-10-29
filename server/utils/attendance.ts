import { prisma } from '~/server/utils/prisma'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { openEmailTransport, sendEmail } from '~/server/utils/email'
import { createRegistrationToken, hashRegistrationToken } from '~/server/utils/registrations'
import { deleteUnusedUploads } from '~/server/utils/uploads'
import {
  ATTENDANCE_STATUSES,
  attendanceDisplayStatus,
  attendanceInvitationEmailText,
  attendanceReminderEmailText,
  canAnswerAttendance,
  canReleaseAttendance
} from '~/utils/attendance'

// Même réponse pour un jeton inconnu ou invalidé (ADR-0018)
export const INVALID_ATTENDANCE_LINK_MESSAGE = 'Ce lien n’est pas valide.'
const TOKEN_PATTERN = /^[\w-]{43}$/

export function attendanceUrl(token: string) {
  return absoluteAppUrl(`/presence/${token}`)
}

const sessionContextSelect = {
  id: true,
  name: true,
  date: true,
  status: true,
  game: { select: { title: true } },
  location: { select: { name: true, address: true } },
  postponedFrom: { select: { name: true } }
} as const

async function attendanceSession(sessionId: string) {
  return await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: sessionContextSelect })
}

type AttendanceSession = Awaited<ReturnType<typeof attendanceSession>>

function emailParams(session: AttendanceSession, participantName: string, responseDueAt: Date) {
  return {
    participantName,
    gameTitle: session.game.title,
    previousSessionName: session.postponedFrom?.name ?? null,
    sessionName: session.name,
    sessionDate: session.date,
    locationName: session.location?.name ?? null,
    responseDueAt
  }
}

/** Suivi de la session : une ligne par personne de l'équipe, avec son statut affiché (US-024). */
export async function getSessionAttendance(sessionId: string, now = new Date()) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      id: true,
      postponedFrom: { select: { id: true, name: true, slug: true } },
      participants: { select: { role: true, participant: { select: { id: true, name: true, email: true } } } },
      attendances: { include: { participant: { select: { id: true, name: true, email: true } } } }
    }
  })

  const roles = new Map<string, string[]>()
  for (const member of session.participants) {
    roles.set(member.participant.id, [...(roles.get(member.participant.id) ?? []), member.role])
  }

  return {
    postponedFrom: session.postponedFrom,
    sent: session.attendances.length > 0,
    team: [...new Map(session.participants.map((member) => [member.participant.id, member.participant])).values()].length,
    rows: session.attendances
      .map((attendance) => ({
        participant: attendance.participant,
        roles: roles.get(attendance.participantId) ?? [],
        status: attendance.status,
        displayStatus: attendanceDisplayStatus(attendance, now),
        canRelease: canReleaseAttendance(attendance, now),
        responseDueAt: attendance.responseDueAt,
        invitationSentAt: attendance.invitationSentAt,
        lastRemindedAt: attendance.lastRemindedAt,
        respondedAt: attendance.respondedAt
      }))
      .sort((left, right) => left.participant.name.localeCompare(right.participant.name, 'fr'))
  }
}

/**
 * Demande de confirmation à toute l'équipe d'une session reportée (US-024) : une ligne et un lien
 * personnel par personne, sur une seule connexion SMTP. Une personne déjà sollicitée n'est pas
 * relancée ici ; une personne sans email a sa ligne, sans envoi. Un échec n'arrête pas les autres.
 */
export async function sendAttendanceRequests(sessionId: string, responseDueAt: Date) {
  const session = await attendanceSession(sessionId)
  if (!session.postponedFrom) {
    throw createError({ statusCode: 409, message: 'La confirmation de présence ne se demande que pour une session reportée.' })
  }

  const members = await prisma.sessionParticipant.findMany({
    where: { sessionId },
    select: { participant: { select: { id: true, name: true, email: true } } }
  })
  const already = new Set((await prisma.sessionAttendance.findMany({ where: { sessionId }, select: { participantId: true } }))
    .map((attendance) => attendance.participantId))
  const people = [...new Map(members.map((member) => [member.participant.id, member.participant])).values()]
    .filter((person) => !already.has(person.id))
  if (!people.length) return { sentCount: 0, withoutEmail: [] as string[], failures: [] as string[] }

  const withEmail = people.filter((person) => person.email)
  const transport = withEmail.length ? await openEmailTransport().catch(() => null) : null
  if (withEmail.length && !transport) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé ou mal configuré' })
  }

  let sentCount = 0
  const failures: string[] = []
  try {
    for (const person of people) {
      const { token, tokenHash } = createRegistrationToken()
      const attendance = await prisma.sessionAttendance.create({
        data: { sessionId, participantId: person.id, tokenHash, responseDueAt }
      })
      if (!person.email) continue
      try {
        await transport!.send({
          to: person.email,
          subject: `Session reportée : ${session.game.title}`,
          text: attendanceInvitationEmailText({ ...emailParams(session, person.name, responseDueAt), url: attendanceUrl(token) })
        })
      } catch {
        failures.push(person.name)
        continue
      }
      await prisma.sessionAttendance.update({ where: { id: attendance.id }, data: { invitationSentAt: new Date() } })
      sentCount++
    }
  } finally {
    transport?.close()
  }

  return { sentCount, withoutEmail: people.filter((person) => !person.email).map((person) => person.name), failures }
}

async function findAttendanceOr404(sessionId: string, participantId: string) {
  const attendance = await prisma.sessionAttendance.findUnique({
    where: { sessionId_participantId: { sessionId, participantId } },
    include: { participant: { select: { name: true, email: true } } }
  })
  if (!attendance) {
    throw createError({ statusCode: 404, message: 'Aucune demande de présence pour cette personne' })
  }
  return attendance
}

async function sendOrFail(message: Parameters<typeof sendEmail>[0], what: string) {
  const result = await sendEmail(message).catch((error: { message?: string }) => ({ sent: false, reason: error?.message || 'erreur SMTP' }))
  if (!result.sent) {
    const reason = 'reason' in result && result.reason !== 'smtp_disabled' ? result.reason : 'envoi d’emails désactivé'
    throw createError({ statusCode: 502, message: `${what} n’est pas parti : ${reason}.` })
  }
}

/** Rappel sans lien à une personne qui n'a pas répondu (US-024) : son lien reste valable. */
export async function remindAttendance(sessionId: string, participantId: string) {
  const attendance = await findAttendanceOr404(sessionId, participantId)
  if (attendance.status !== ATTENDANCE_STATUSES.pending) {
    throw createError({ statusCode: 409, message: 'Cette personne a déjà répondu, ou sa place est libérée.' })
  }
  if (!attendance.invitationSentAt || !attendance.participant.email) {
    throw createError({ statusCode: 409, message: 'La demande n’est jamais partie : renvoyez-la plutôt que de relancer.' })
  }
  const session = await attendanceSession(sessionId)
  await sendOrFail({
    to: attendance.participant.email,
    subject: `Rappel – session reportée : ${session.game.title}`,
    text: attendanceReminderEmailText({ ...emailParams(session, attendance.participant.name, attendance.responseDueAt), invitationSentAt: attendance.invitationSentAt })
  }, 'Le rappel')
  await prisma.sessionAttendance.update({ where: { id: attendance.id }, data: { lastRemindedAt: new Date() } })
  return { sent: true }
}

/** Nouveau lien (l'ancien cesse de fonctionner), par exemple quand la personne a perdu l'email (US-024). */
export async function resendAttendance(sessionId: string, participantId: string) {
  const attendance = await findAttendanceOr404(sessionId, participantId)
  if (attendance.status === ATTENDANCE_STATUSES.released) {
    throw createError({ statusCode: 409, message: 'La place de cette personne est libérée.' })
  }
  if (!attendance.participant.email) {
    throw createError({ statusCode: 409, message: 'Cette personne n’a pas d’adresse email.' })
  }
  const session = await attendanceSession(sessionId)
  const { token, tokenHash } = createRegistrationToken()
  await sendOrFail({
    to: attendance.participant.email,
    subject: `Session reportée : ${session.game.title}`,
    text: attendanceInvitationEmailText({ ...emailParams(session, attendance.participant.name, attendance.responseDueAt), url: attendanceUrl(token) })
  }, 'Le nouveau lien')
  await prisma.sessionAttendance.update({ where: { id: attendance.id }, data: { tokenHash, invitationSentAt: new Date() } })
  return { sent: true }
}

/** Nouvelle date limite, choisie par l'organisation (US-024). */
export async function extendAttendance(sessionId: string, participantId: string, responseDueAt: Date) {
  const attendance = await findAttendanceOr404(sessionId, participantId)
  if (attendance.status === ATTENDANCE_STATUSES.released) {
    throw createError({ statusCode: 409, message: 'La place de cette personne est libérée.' })
  }
  await prisma.sessionAttendance.update({ where: { id: attendance.id }, data: { responseDueAt } })
  return { responseDueAt }
}

/**
 * Libère la place d'une personne qui ne viendra pas ou n'a pas répondu à temps (US-024) : elle quitte
 * l'équipe, le casting et le déroulé de la session ; son lien cesse de fonctionner. Son paiement éventuel
 * reste, et apparaît dans les paiements à traiter.
 */
export async function releaseAttendance(sessionId: string, participantId: string, now = new Date()) {
  const attendance = await findAttendanceOr404(sessionId, participantId)
  if (!canReleaseAttendance(attendance, now)) {
    throw createError({ statusCode: 409, message: 'Seule la place d’une personne qui ne viendra pas, ou qui n’a pas répondu à temps, se libère.' })
  }
  const photos = await prisma.sessionAssignment.findMany({ where: { sessionId, participantId }, select: { photoUrl: true } })

  await prisma.$transaction(async (tx) => {
    await tx.sessionParticipant.deleteMany({ where: { sessionId, participantId } })
    await tx.timelineEventResponsible.deleteMany({ where: { sessionId, participantId } })
    await tx.sessionAssignment.updateMany({ where: { sessionId, participantId }, data: { participantId: null, photoUrl: null } })
    await tx.sessionAttendance.update({ where: { id: attendance.id }, data: { status: ATTENDANCE_STATUSES.released, tokenHash: null } })
    await tx.session.update({ where: { id: sessionId }, data: { updatedAt: now } })
  })
  await deleteUnusedUploads(photos.map((photo) => photo.photoUrl))
  return { released: true }
}

// --- Lien personnel (routes publiques) ---

async function findAttendanceByToken(token: string | undefined) {
  if (!token || !TOKEN_PATTERN.test(token)) return null
  return await prisma.sessionAttendance.findUnique({
    where: { tokenHash: hashRegistrationToken(token) },
    include: { participant: { select: { name: true } }, session: { select: sessionContextSelect } }
  })
}

async function requireAttendanceByToken(token: string | undefined) {
  const attendance = await findAttendanceByToken(token)
  if (!attendance) throw createError({ statusCode: 404, message: INVALID_ATTENDANCE_LINK_MESSAGE })
  return attendance
}

// Ce que voit la personne : la session et sa propre réponse, rien sur les autres
export async function exposeAttendanceByToken(token: string | undefined, now = new Date()) {
  const attendance = await requireAttendanceByToken(token)
  return {
    participantName: attendance.participant.name,
    gameTitle: attendance.session.game.title,
    previousSessionName: attendance.session.postponedFrom?.name ?? null,
    sessionName: attendance.session.name,
    sessionDate: attendance.session.date,
    location: attendance.session.location,
    status: attendance.status,
    responseDueAt: attendance.responseDueAt,
    respondedAt: attendance.respondedAt,
    canAnswer: canAnswerAttendance(attendance, now)
  }
}

export async function answerAttendanceByToken(token: string | undefined, answer: 'confirmed' | 'declined', now = new Date()) {
  const attendance = await requireAttendanceByToken(token)
  if (!canAnswerAttendance(attendance, now)) {
    throw createError({ statusCode: 409, message: 'La date limite est passée : prévenez l’équipe d’organisation pour changer votre réponse.' })
  }
  // Conditionnel : une place libérée entre-temps n'est pas réécrite
  const updated = await prisma.sessionAttendance.updateMany({
    where: { id: attendance.id, status: { not: ATTENDANCE_STATUSES.released } },
    data: { status: answer, respondedAt: now }
  })
  if (!updated.count) throw createError({ statusCode: 404, message: INVALID_ATTENDANCE_LINK_MESSAGE })
  return await exposeAttendanceByToken(token, now)
}
