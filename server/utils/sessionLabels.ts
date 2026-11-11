// Chemins relatifs : les jeux de test (`prisma/seed.ts`) importent ce fichier hors de Nuxt
import type { prisma, PrismaTx } from './prisma'
import { generateSlug } from './generateSlug'
import { sessionDayKey, sessionLabels } from '../../utils/sessionLabels'

// Libellé et adresse d'une session (SPEC-021, ADR-0084) : la session n'a pas de nom. Le libellé se calcule à chaque
// lecture, avec les autres sessions de son jeu, et n'est jamais écrit en base ni comparé ; seule l'adresse, identifiant
// de page fait du jeu et de la date, est gardée

type Db = PrismaTx | typeof prisma

const siblings = { id: true, gameId: true, date: true, createdAt: true, location: { select: { name: true } } } as const

/** Libellé de chaque session des jeux qui contiennent les sessions données, en une requête. */
export async function sessionLabelsFor(db: Db, sessionIds: string[]) {
  if (!sessionIds.length) return new Map<string, string>()
  const rows = await db.session.findMany({ where: { game: { sessions: { some: { id: { in: [...new Set(sessionIds)] } } } } }, select: siblings })
  const byGame = new Map<string, typeof rows>()
  for (const row of rows) byGame.set(row.gameId, [...(byGame.get(row.gameId) ?? []), row])
  const labels = new Map<string, string>()
  for (const game of byGame.values()) {
    for (const [id, label] of sessionLabels(game.map((row) => ({ ...row, locationName: row.location?.name })))) labels.set(id, label)
  }
  return labels
}

/** Les sessions lues, chacune avec son libellé. */
export async function labelSessions<T extends { id: string }>(db: Db, sessions: T[]): Promise<Array<T & { label: string }>> {
  const labels = await sessionLabelsFor(db, sessions.map((session) => session.id))
  return sessions.map((session) => ({ ...session, label: labels.get(session.id) ?? 'Session' }))
}

/** Une session lue, avec son libellé. */
export async function labelSession<T extends { id: string }>(db: Db, session: T): Promise<T & { label: string }> {
  return (await labelSessions(db, [session]))[0]!
}

/** Adresse de base d'une session (R5) : le jeu et le jour, ou « sans-date ». */
const baseSlug = (gameSlug: string, date: Date | null) => generateSlug(`${gameSlug} ${sessionDayKey(date) ?? 'sans date'}`) || 'session'
const fits = (slug: string, base: string) => slug === base || new RegExp(`^${base}-\\d+$`).test(slug)

/**
 * Recalcule l'adresse des sessions du jeu dont la date ne correspond plus à la leur, sans toucher à leur version
 * (`updatedAt`). Appelée dans la transaction d'une écriture qui crée une session ou change sa date, et au démarrage.
 */
export async function refreshSessionSlugs(db: Db, gameId: string) {
  const game = await db.game.findUnique({ where: { id: gameId }, select: { slug: true, sessions: { orderBy: { createdAt: 'asc' }, select: { id: true, slug: true, date: true } } } })
  if (!game?.sessions.length) return
  const moving = game.sessions.filter((session) => !fits(session.slug, baseSlug(game.slug, session.date)))
  if (!moving.length) return
  const bases = [...new Set(moving.map((session) => baseSlug(game.slug, session.date)))]
  const taken = new Set((await db.session.findMany({ where: { OR: bases.map((base) => ({ slug: { startsWith: base } })) }, select: { id: true, slug: true } }))
    .filter((row) => !moving.some((session) => session.id === row.id)).map((row) => row.slug))
  // Une session peut prendre l'adresse qu'une autre quitte : celles qui en changent la libèrent d'abord
  for (const session of moving) await db.$executeRaw`UPDATE "Session" SET "slug" = ${`session-${session.id}`} WHERE "id" = ${session.id}`
  for (const session of moving) {
    const base = baseSlug(game.slug, session.date)
    let slug = base
    for (let suffix = 2; taken.has(slug); suffix++) slug = `${base}-${suffix}`
    taken.add(slug)
    await db.$executeRaw`UPDATE "Session" SET "slug" = ${slug} WHERE "id" = ${session.id}`
  }
}

const SESSION_KEYS = new Set(['session', 'invitedSession', 'postponedTo', 'postponedFrom'])
type SessionKey = 'session' | 'invitedSession' | 'postponedTo' | 'postponedFrom'
type LabelledSession<V> = V extends null | undefined ? V : Labelled<V> & { label: string }
/** Une lecture dont chaque session imbriquée porte son libellé. */
export type Labelled<T> = T extends Date | Uint8Array ? T
  : T extends Array<infer U> ? Array<Labelled<U>>
    : T extends object ? { [K in keyof T]: K extends SessionKey ? LabelledSession<T[K]> : Labelled<T[K]> }
      : T
type Plain = Record<string, unknown>
const isPlain = (value: unknown): value is Plain => Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !Buffer.isBuffer(value)

/**
 * Ajoute `label` à chaque session imbriquée dans une lecture (clés `session`, `invitedSession`, `postponedTo`,
 * `postponedFrom`, lues avec leur `id`) ; `dropId` retire ensuite cet identifiant (export des données d'une personne).
 */
export async function labelNestedSessions<T>(db: Db, value: T, options: { dropId?: boolean } = {}): Promise<Labelled<T>> {
  const ids: string[] = []
  const collect = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(collect)
    if (!isPlain(node)) return
    for (const [key, child] of Object.entries(node)) {
      if (SESSION_KEYS.has(key) && isPlain(child) && typeof child.id === 'string') ids.push(child.id)
      collect(child)
    }
  }
  collect(value)
  const labels = await sessionLabelsFor(db, ids)
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite)
    if (!isPlain(node)) return node
    return Object.fromEntries(Object.entries(node).map(([key, child]) => {
      if (SESSION_KEYS.has(key) && isPlain(child) && typeof child.id === 'string') {
        const { id, ...rest } = rewrite(child) as Plain
        return [key, { ...(options.dropId ? {} : { id }), ...rest, label: labels.get(id as string) ?? 'Session' }]
      }
      return [key, rewrite(child)]
    }))
  }
  return rewrite(value) as Labelled<T>
}
