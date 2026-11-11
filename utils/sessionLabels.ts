import { PARIS_TIME_ZONE } from './dates'

// Libellé d'une session (SPEC-021, ADR-0084) : une session n'a pas de nom, elle se lit par sa date à l'heure de Paris ;
// il se calcule à chaque lecture, jamais gardé en base ni comparé

type DateValue = Date | string | null | undefined

/** Une session du jeu, avec ce qui la distingue d'une voisine du même jour. */
export type LabelledSession = { id: string, date: DateValue, createdAt: Date | string, locationName?: string | null }

const parts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).formatToParts(date).map((part) => [part.type, part.value]))

/** Jour à l'heure de Paris, `AAAA-MM-JJ` : la clé des doublons et la partie date de l'adresse (R5). */
export function sessionDayKey(value: DateValue) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: PARIS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

/** « Session du 15 mai 2099 », « Session du 1er mai 2099 » ; sans date, « Session sans date » (R1). */
export function sessionDayLabel(value: DateValue) {
  if (!value) return 'Session sans date'
  const { day, month, year } = parts(new Date(value))
  return `Session du ${day === '1' ? '1er' : day} ${month} ${year}`
}

/** « 14 h », « 14 h 30 », à l'heure de Paris. */
export function sessionHourLabel(value: Date | string) {
  const { hour, minute } = parts(new Date(value))
  return `${Number(hour)} h${minute === '00' ? '' : ` ${minute}`}`
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return [...groups.values()]
}

const byCreation = (left: LabelledSession, right: LabelledSession) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()

/**
 * Libellés de toutes les sessions d'un jeu (R2) : le jour ; avec une voisine le même jour, l'heure ; à la même heure,
 * le lieu ; si elles restent pareilles, un numéro dans l'ordre de création. Sans date, le lieu puis le numéro.
 */
export function sessionLabels(sessions: LabelledSession[]) {
  const labels = new Map<string, string>()
  // Ajoute à chaque libellé du groupe ce qui le distingue, tant que plusieurs restent pareils
  const settle = (group: LabelledSession[], base: (session: LabelledSession) => string, steps: Array<(session: LabelledSession) => string>) => {
    if (group.length === 1) {
      labels.set(group[0]!.id, base(group[0]!))
      return
    }
    const [step, ...rest] = steps
    if (!step) {
      group.sort(byCreation).forEach((session, index) => labels.set(session.id, index ? `${base(session)} (${index + 1})` : base(session)))
      return
    }
    for (const sub of groupBy(group, step)) settle(sub, (session) => `${base(session)}${step(session)}`, rest)
  }
  const hour = (session: LabelledSession) => (session.date ? `, ${sessionHourLabel(session.date)}` : '')
  const place = (session: LabelledSession) => (session.locationName ? ` — ${session.locationName}` : '')
  for (const group of groupBy(sessions, (session) => sessionDayKey(session.date) ?? '')) {
    const dated = Boolean(group[0]!.date)
    settle(group, (session) => sessionDayLabel(session.date), dated ? [hour, place] : [place])
  }
  return labels
}

/** Le libellé au fil d'une phrase : « la session du 15 mai 2099 », « de la session sans date ». */
export const inSentence = (label: string) => label.charAt(0).toLowerCase() + label.slice(1)
