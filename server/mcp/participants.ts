import * as z from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { PAGE_SIZE, READ_ONLY, pageOf, skipOf, toolResult, type ToolContext } from '~/server/mcp/tools'

// Participants d'un jeu (R7, R8) : nom et notes d'organisation de ce jeu, jamais les coordonnées ni les allergies
export function registerParticipantTools({ event, server }: ToolContext) {
  server.registerTool('lister_participants', {
    title: 'Lister les participants',
    description: `Participants d’un jeu (${PAGE_SIZE} par page) : nom, notes d’organisation de l’équipe pour ce jeu et version (updatedAt). Aucune coordonnée.`,
    inputSchema: z.object({
      jeuId: z.string(),
      recherche: z.string().max(100).optional().describe('Filtre sur le nom'),
      page: z.number().int().min(1).optional()
    }),
    annotations: READ_ONLY
  }, ({ jeuId, recherche, page }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    const where = { gameId: jeuId, ...(recherche ? { participant: { name: { contains: recherche, mode: 'insensitive' as const } } } : {}) }
    const [links, total] = await Promise.all([
      prisma.participantGame.findMany({
        where,
        orderBy: { participant: { name: 'asc' } },
        skip: skipOf(page),
        take: PAGE_SIZE,
        select: { notes: true, participant: { select: { id: true, name: true, updatedAt: true } } }
      }),
      prisma.participantGame.count({ where })
    ])
    return pageOf(links.map((link) => ({ id: link.participant.id, name: link.participant.name, notes: link.notes, updatedAt: link.participant.updatedAt })), page, total)
  }))
}
