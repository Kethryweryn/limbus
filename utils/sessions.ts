import { CHARACTER_TYPES, SESSION_STATUSES, SESSION_STATUS_META, metaOf } from '~/utils/domain'

// Sessions (US-116) : ce que partagent la liste, la page d'une session et leurs composants

/** Date d'un champ datetime-local, à l'heure de l'appareil. */
export function toDatetimeLocal(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

/** Session prête pour son formulaire : date au format du champ, lieu vide plutôt qu'absent. L'équipe par rôle et le
 * cast sont repris par SessionForm. */
export function sessionFormPayload<T extends { date?: string | Date | null, locationId?: string | null }>(session: T) {
  return { ...session, date: toDatetimeLocal(session.date), locationId: session.locationId || '' }
}

export function sessionStatusMeta(status: string) {
  return metaOf(SESSION_STATUS_META, status) ?? SESSION_STATUS_META[SESSION_STATUSES.scheduled]
}

export const formatSessionDate = (value: string | Date) => new Date(value).toLocaleString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

/** Date d'un envoi ou d'un paiement : jour et heure, chiffres seuls. */
export const formatEventDate = (value: string | Date | null | undefined) => value
  ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : ''

/** Avancement du cast : les rôles joueurs attribués, sans les PNJ. */
export function castProgress(assignments: Array<{ participantId?: string | null, participant?: { id: string } | null, character?: { type: string } | null }> = []) {
  const roles = assignments.filter((assignment) => assignment.character?.type !== CHARACTER_TYPES.pnj)
  const assigned = roles.filter((assignment) => assignment.participantId || assignment.participant?.id).length
  return { assigned, total: roles.length, percent: roles.length ? Math.round((assigned / roles.length) * 100) : 0 }
}
