import { prisma } from './prisma'

/**
 * Nom et téléphone d'une personne tels que les tient l'équipe d'un jeu (SPEC-022 R6, ADR-0086, US-237, US-242) : ils
 * vivent seulement sur le lien entre la fiche et chaque jeu, et une équipe ne lit jamais ceux d'une autre. Une lecture
 * faite dans un jeu (session, casting, inscription, paiement…) reçoit donc ceux de ce jeu, sans repli possible.
 */

type Plain = Record<string, unknown>
type GameValue = { name: string, phone: string | null }

// Clés sous lesquelles une lecture expose une fiche participant : celles des relations vers `Participant` du schéma,
// ce que vérifie tests/server/participantValues.test.ts
export const PARTICIPANT_KEYS = new Set(['participant', 'targetParticipant', 'transferredTo'])
type FicheKey = 'participant' | 'targetParticipant' | 'transferredTo'

// Ce que reçoit chaque fiche d'une lecture : son nom, et son téléphone si la lecture le demande
type FicheValues<P extends boolean> = P extends true ? { name: string, phone: string | null } : { name: string }
type NamedFiche<F, P extends boolean> = F extends null ? null : F extends object ? GameNamed<F, P> & FicheValues<P> : F
/** Une lecture dont chaque fiche porte le nom (et le téléphone) du jeu où elle est lue. */
// Une colonne JSON (réponses, définitions) ne contient pas de fiche : le type s'arrête à un objet à clés libres, sans
// parcourir ce qu'il contient
export type GameNamed<T, P extends boolean = false> =
  T extends Date ? T
    : T extends readonly unknown[] ? { -readonly [K in keyof T]: GameNamed<T[K], P> }
      : T extends object ? (string extends keyof T ? T : { [K in keyof T]: K extends FicheKey ? NamedFiche<T[K], P> : GameNamed<T[K], P> })
        : T

const isPlain = (value: unknown): value is Plain =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)

const isFiche = (value: unknown): value is Plain & { id: string } => isPlain(value) && typeof value.id === 'string'

const pairKey = (gameId: string, participantId: string) => `${gameId}:${participantId}`

/**
 * Donne, dans une lecture, à chaque fiche le nom (et, avec `phone`, le téléphone) du jeu où elle est lue. Le jeu est le
 * `gameId` de l'objet le plus proche qui en porte un (session, inscription, ligne de casting…), sinon `gameId`. La
 * lecture est modifiée sur place et renvoyée. La fiche doit porter son identifiant.
 */
export async function withGameValues<T, P extends boolean = false>(value: T, gameId?: string | null, options: { phone?: P } = {}): Promise<GameNamed<T, P>> {
  const found: Array<{ gameId: string, fiche: Plain & { id: string } }> = []
  const walk = (node: unknown, context: string | null | undefined, key?: string) => {
    if (Array.isArray(node)) return node.forEach((child) => walk(child, context, key))
    if (!isPlain(node)) return
    const here = typeof node.gameId === 'string' ? node.gameId : context
    if (key && PARTICIPANT_KEYS.has(key) && isFiche(node) && here) found.push({ gameId: here, fiche: node })
    for (const [childKey, child] of Object.entries(node)) walk(child, here, childKey)
  }
  walk(value, gameId)
  if (found.length) {
    const values = await gameValues(found.map(({ gameId, fiche }) => ({ gameId, participantId: fiche.id })))
    for (const { gameId, fiche } of found) applyValue(fiche, values.get(pairKey(gameId, fiche.id)), Boolean(options.phone))
  }
  return value as GameNamed<T, P>
}

/** Les fiches d'une liste, chacune avec les valeurs de son jeu (lecture faite dans un seul jeu). */
export async function withGameValuesIn<T extends { id: string }, P extends boolean = false>(fiches: T[], gameId: string, options: { phone?: P } = {}): Promise<Array<T & FicheValues<P>>> {
  const values = await gameValues(fiches.map((fiche) => ({ gameId, participantId: fiche.id })))
  for (const fiche of fiches) applyValue(fiche as unknown as Plain, values.get(pairKey(gameId, fiche.id)), Boolean(options.phone))
  return fiches as Array<T & FicheValues<P>>
}

/**
 * Hors d'un jeu précis (page Participants, fiche) : les valeurs du jeu visible le plus récemment modifié parmi les
 * liens lus. `gameLinks` doit porter `name`, `phone` et `updatedAt`.
 */
export function latestVisibleValues<T extends Plain & { gameLinks?: Array<{ name?: string, phone?: string | null, updatedAt?: Date }> }>(fiche: T): T & { name: string, phone: string | null } {
  const latest = [...(fiche.gameLinks || [])].sort((left, right) => (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0))[0]
  applyValue(fiche, latest ? { name: latest.name ?? '', phone: latest.phone ?? null } : undefined, true)
  return fiche as T & { name: string, phone: string | null }
}

/** Tri par nom, à l'affichage : les valeurs du jeu peuvent différer de l'ordre de la fiche. */
export const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name, 'fr')

function applyValue(fiche: Plain, value: GameValue | undefined, withPhone: boolean) {
  fiche.name = value?.name ?? ''
  if (withPhone) fiche.phone = value?.phone ?? null
}

async function gameValues(pairs: Array<{ gameId: string, participantId: string }>) {
  const byGame = new Map<string, Set<string>>()
  for (const { gameId, participantId } of pairs) {
    if (!byGame.has(gameId)) byGame.set(gameId, new Set())
    byGame.get(gameId)!.add(participantId)
  }
  const rows = byGame.size
    ? await prisma.participantGame.findMany({
        where: { OR: [...byGame].map(([gameId, ids]) => ({ gameId, participantId: { in: [...ids] } })) },
        select: { gameId: true, participantId: true, name: true, phone: true }
      })
    : []
  return new Map(rows.map((row) => [pairKey(row.gameId, row.participantId), { name: row.name, phone: row.phone }]))
}

/** Nom de chaque fiche tel que le tient l'équipe d'un jeu (messages, listes construites à la main). */
export async function namesIn(gameId: string, participantIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(participantIds)]
  if (!ids.length) return new Map()
  const links = await prisma.participantGame.findMany({ where: { gameId, participantId: { in: ids } }, select: { participantId: true, name: true } })
  const names = new Map(ids.map((id) => [id, '']))
  for (const link of links) names.set(link.participantId, link.name)
  return names
}

/** Jeu d'une session, pour lire les noms d'une requête qui ne le porte pas. */
export const gameIdOfSession = async (sessionId: string) =>
  (await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: { gameId: true } })).gameId

/** Plus récente des dates données, ou null : la version d'une fiche pour une équipe (ADR-0086). */
export function latestOf(dates: Array<Date | null | undefined>): Date | null {
  const times = dates.filter((date): date is Date => Boolean(date)).map((date) => date.getTime())
  return times.length ? new Date(Math.max(...times)) : null
}

/**
 * Version de chaque fiche pour une équipe : le plus récent `updatedAt` des liens qu'elle voit (`gameIds`, ou null pour
 * tous). Une modification d'une autre équipe, sur ses propres jeux, n'y entre pas.
 */
export async function participantVersions(participantIds: string[], gameIds: string[] | null): Promise<Map<string, Date | null>> {
  if (!participantIds.length) return new Map()
  const rows = await prisma.participantGame.groupBy({
    by: ['participantId'],
    where: { participantId: { in: participantIds }, ...(gameIds === null ? {} : { gameId: { in: gameIds } }) },
    _max: { updatedAt: true }
  })
  return new Map(rows.map((row) => [row.participantId, row._max.updatedAt]))
}
