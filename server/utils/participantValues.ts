import { prisma } from './prisma'

/**
 * Nom et téléphone d'une personne tels que les tient l'équipe d'un jeu (SPEC-022 R6, ADR-0086, US-237) : ils vivent
 * sur le lien entre la fiche et chaque jeu, et une équipe ne lit jamais ceux d'une autre. Une lecture faite dans un
 * jeu (session, casting, inscription, paiement…) remplace donc ceux de la fiche par ceux de ce jeu.
 */

type Plain = Record<string, unknown>
type GameValue = { name: string | null, phone: string | null }

// Clés sous lesquelles une lecture expose une fiche participant
const PARTICIPANT_KEYS = new Set(['participant', 'targetParticipant', 'transferredTo'])

const isPlain = (value: unknown): value is Plain =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)

const isFiche = (value: unknown): value is Plain & { id: string } =>
  isPlain(value) && typeof value.id === 'string' && ('name' in value || 'phone' in value)

const pairKey = (gameId: string, participantId: string) => `${gameId}:${participantId}`

/**
 * Remplace, dans une lecture, le nom et le téléphone de chaque fiche par ceux du jeu où elle est lue. Le jeu est le
 * `gameId` de l'objet le plus proche qui en porte un (session, inscription, ligne de casting…), sinon `gameId`.
 * La lecture est modifiée sur place et renvoyée. Un lien sans valeur garde celle de la fiche.
 */
export async function withGameValues<T>(value: T, gameId?: string | null): Promise<T> {
  const found: Array<{ gameId: string, fiche: Plain & { id: string } }> = []
  const walk = (node: unknown, context: string | null | undefined, key?: string) => {
    if (Array.isArray(node)) return node.forEach((child) => walk(child, context, key))
    if (!isPlain(node)) return
    const here = typeof node.gameId === 'string' ? node.gameId : context
    if (key && PARTICIPANT_KEYS.has(key) && isFiche(node) && here) found.push({ gameId: here, fiche: node })
    for (const [childKey, child] of Object.entries(node)) walk(child, here, childKey)
  }
  walk(value, gameId)
  if (!found.length) return value

  const values = await gameValues(found.map(({ gameId, fiche }) => ({ gameId, participantId: fiche.id })))
  for (const { gameId, fiche } of found) applyValue(fiche, values.get(pairKey(gameId, fiche.id)))
  return value
}

/** Les fiches d'une liste, chacune avec les valeurs de son jeu (lecture faite dans un seul jeu). */
export async function withGameValuesIn<T extends { id: string }>(fiches: T[], gameId: string): Promise<T[]> {
  const values = await gameValues(fiches.map((fiche) => ({ gameId, participantId: fiche.id })))
  for (const fiche of fiches) applyValue(fiche as unknown as Plain, values.get(pairKey(gameId, fiche.id)))
  return fiches
}

/**
 * Hors d'un jeu précis (page Participants, fiche) : les valeurs du jeu visible le plus récemment modifié parmi les
 * liens lus. `gameLinks` doit porter `name`, `phone` et `updatedAt`.
 */
export function latestVisibleValues<T extends Plain & { gameLinks?: Array<{ name?: string | null, phone?: string | null, updatedAt?: Date }> }>(fiche: T): T {
  const latest = [...(fiche.gameLinks || [])].sort((left, right) => (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0))[0]
  if (latest) applyValue(fiche, { name: latest.name ?? null, phone: latest.phone ?? null })
  return fiche
}

/** Tri par nom, à l'affichage : les valeurs du jeu peuvent différer de l'ordre de la fiche. */
export const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name, 'fr')

function applyValue(fiche: Plain, value: GameValue | undefined) {
  if (!value) return
  if ('name' in fiche && value.name) fiche.name = value.name
  if ('phone' in fiche && value.name !== null) fiche.phone = value.phone
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
  const [links, fiches] = await Promise.all([
    prisma.participantGame.findMany({ where: { gameId, participantId: { in: ids } }, select: { participantId: true, name: true } }),
    prisma.participant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  ])
  const names = new Map(fiches.map((fiche) => [fiche.id, fiche.name]))
  for (const link of links) if (link.name) names.set(link.participantId, link.name)
  return names
}

/** Jeu d'une session, pour lire les noms d'une requête qui ne le porte pas. */
export const gameIdOfSession = async (sessionId: string) =>
  (await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: { gameId: true } })).gameId
