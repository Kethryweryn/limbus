// Confirmation de présence à une session reportée (US-024, ADR-0029) : partagé entre le serveur et l'aperçu de l'email

export const ATTENDANCE_STATUSES = {
  pending: 'pending',
  confirmed: 'confirmed',
  declined: 'declined',
  released: 'released'
} as const

// Statut affiché : « délai dépassé » s'évalue à la lecture, rien ne change tout seul (ADR-0020)
export const ATTENDANCE_DISPLAY = {
  pending: { label: 'En attente', color: 'neutral' },
  overdue: { label: 'Délai dépassé', color: 'warning' },
  confirmed: { label: 'Confirmé', color: 'success' },
  declined: { label: 'Ne viendra pas', color: 'error' },
  released: { label: 'Place libérée', color: 'neutral' }
} as const

export const DEFAULT_ATTENDANCE_DELAY_DAYS = 7

export function attendanceDisplayStatus(row: { status: string, responseDueAt: Date | string }, now = new Date()): keyof typeof ATTENDANCE_DISPLAY {
  if (row.status === ATTENDANCE_STATUSES.pending && new Date(row.responseDueAt).getTime() < now.getTime()) return 'overdue'
  return (row.status in ATTENDANCE_DISPLAY ? row.status : 'pending') as keyof typeof ATTENDANCE_DISPLAY
}

// La personne peut répondre tant que sa place n'est pas libérée ; elle change d'avis jusqu'à la date limite
export function canAnswerAttendance(row: { status: string, responseDueAt: Date | string }, now = new Date()) {
  if (row.status === ATTENDANCE_STATUSES.released) return false
  return row.status === ATTENDANCE_STATUSES.pending || new Date(row.responseDueAt).getTime() >= now.getTime()
}

// Une place se libère quand la personne ne viendra pas, ou n'a pas répondu à temps
export function canReleaseAttendance(row: { status: string, responseDueAt: Date | string }, now = new Date()) {
  const display = attendanceDisplayStatus(row, now)
  return display === 'declined' || display === 'overdue'
}

const formatDate = (value: Date | string) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })
const formatDateTime = (value: Date | string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' })

type AttendanceEmailParams = {
  participantName: string
  gameTitle: string
  previousSessionName: string | null
  sessionName: string
  sessionDate: Date | string | null
  locationName: string | null
  responseDueAt: Date | string
}

export function attendanceInvitationEmailText(params: AttendanceEmailParams & { url: string }) {
  return [
    `Bonjour ${params.participantName},`,
    '',
    `La session${params.previousSessionName ? ` « ${params.previousSessionName} »` : ''} de « ${params.gameTitle} » est reportée.`,
    `Nouvelle date : ${params.sessionDate ? formatDateTime(params.sessionDate) : 'à préciser'}${params.locationName ? `, ${params.locationName}` : ''}.`,
    '',
    'Pouvez-vous nous dire si vous serez présent·e ? Répondez avec ce lien personnel :',
    params.url,
    '',
    `Merci de répondre avant le ${formatDate(params.responseDueAt)}.`,
    'Ce lien vous est propre : ne le transférez pas.'
  ].join('\n')
}

// Rappel sans lien, comme pour les inscriptions (ADR-0018) : seul le hash du jeton est stocké
export function attendanceReminderEmailText(params: AttendanceEmailParams & { invitationSentAt: Date | string }) {
  return [
    `Bonjour ${params.participantName},`,
    '',
    `Nous n’avons pas encore votre réponse : serez-vous présent·e à la session reportée de « ${params.gameTitle} »${params.sessionDate ? `, le ${formatDateTime(params.sessionDate)}` : ''} ?`,
    '',
    `Votre lien personnel se trouve dans l’email du ${formatDate(params.invitationSentAt)}, intitulé « Session reportée : ${params.gameTitle} ».`,
    `Merci de répondre avant le ${formatDate(params.responseDueAt)}.`,
    '',
    'Vous ne retrouvez pas cet email ? Prévenez l’équipe d’organisation : elle vous enverra un nouveau lien.'
  ].join('\n')
}
