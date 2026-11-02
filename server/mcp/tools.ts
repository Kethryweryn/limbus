import type { H3Event } from 'h3'
import type { McpServer } from '@modelcontextprotocol/server'

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
    const message = (error as { statusMessage?: string, message?: string })?.message || 'Erreur'
    const status = (error as { statusCode?: number })?.statusCode
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
