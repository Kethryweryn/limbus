import * as z from 'zod'
import type { H3Event } from 'h3'
import type { McpServer } from '@modelcontextprotocol/server'
import { aiLog } from '~/server/utils/aiAuth'

// Outils MCP de Limbus (US-122, SPEC-014 R7 à R9, R12, R15) : chaque outil rend une projection explicite, jamais un
// objet Prisma tel quel, pour qu'aucun champ exclu (coordonnées, allergies, paiements, fichiers, texte libre d'un
// participant) ne sorte par mégarde

export const PAGE_SIZE = 50

export type ToolContext = { event: H3Event, server: McpServer }

type ToolResult = { content: Array<{ type: 'text', text: string }>, isError?: boolean }

/** Résultat d'un outil : le JSON de la projection, ou le message d'une erreur (refus, introuvable…). */
export async function toolResult(run: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await run()) }] }
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode
    // Refus d'une validation : le détail de chaque champ, pour que l'assistant corrige sa demande
    const issues = (error as { data?: Array<{ path?: string, message?: string }> })?.data
    const message = Array.isArray(issues) && issues.length
      ? issues.map((issue) => issue.path ? `${issue.path} : ${issue.message}` : issue.message).join(' ; ')
      : (error as { message?: string })?.message || 'Erreur'
    // Une erreur inattendue ne montre pas son détail à l'assistant
    if (!status || status >= 500) console.error('[mcp] outil en échec', { error: message })
    return { isError: true, content: [{ type: 'text', text: status && status < 500 ? message : 'Erreur du serveur' }] }
  }
}

export function pageOf<T>(items: T[], page: number | undefined, total: number) {
  return { page: page ?? 1, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total, items }
}

export const skipOf = (page: number | undefined) => ((page ?? 1) - 1) * PAGE_SIZE

/** Indications pour l'assistant (R15) : il s'en sert pour demander confirmation ; la sécurité ne repose pas dessus. */
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

/** Nom et identifiant d'un élément lié. */
export const named = { select: { id: true, name: true } } as const

// Écritures (SPEC-014 R10, R13) : réservées aux autorisations en lecture et écriture, avec la version lue, notées au journal

export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }

/** Texte libre d'une fiche écrit par l'assistant. */
export const text = (description: string) => z.string().max(20_000).nullable().optional().describe(description)

export const version = z.string().describe('Version lue : le champ updatedAt rendu par la lecture de l’élément')

export function requireWrite(event: H3Event) {
  const ai = event.context.aiAuthorization
  if (!ai?.canWrite) throw createError({ statusCode: 403, message: 'Autorisation en lecture seule' })
  return ai
}

/** Exécute une écriture avec la version lue, contrôlée comme l'en-tête If-Unmodified-Since de l'interface. */
export async function withVersion<T>(event: H3Event, read: string, run: () => Promise<T>) {
  const at = new Date(read)
  if (Number.isNaN(at.getTime())) throw createError({ statusCode: 400, message: 'Version illisible : donnez le champ updatedAt lu' })
  event.context.writeVersion = at
  try {
    return await run()
  } finally {
    delete event.context.writeVersion
  }
}

// Une fiche participant peut être dans plusieurs jeux : l'écriture est notée pour chacun
export async function logWrite(event: H3Event, tool: string, action: string, target: { type: string, id: string, name: string, gameId: string | string[] }) {
  const ai = requireWrite(event)
  await aiLog({
    authorization: { id: ai.id, userId: ai.userId, client: { name: ai.clientName } },
    action,
    tool,
    gameIds: Array.isArray(target.gameId) ? target.gameId : [target.gameId],
    target: { type: target.type, id: target.id, name: target.name }
  })
}
