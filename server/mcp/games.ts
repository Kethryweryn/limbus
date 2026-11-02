import * as z from 'zod'
import { prisma } from '~/server/utils/prisma'
import { accessibleGameIds, requireGameAccess } from '~/server/utils/gameAccess'
import { READ_ONLY, toolResult, type ToolContext } from '~/server/mcp/tools'

const contentCounts = {
  _count: { select: { characters: true, factions: true, intrigues: true, items: true, documents: true, locations: true, timelineEvents: true, sessions: true } }
} as const

// Jeux de l'autorisation (R5, R7) : sans les réglages de page publique, de photos ni de contact
export function registerGameTools({ event, server }: ToolContext) {
  server.registerTool('lister_jeux', {
    title: 'Lister les jeux',
    description: 'Jeux auxquels cette autorisation donne accès, avec le nombre d’éléments de chaque sorte.',
    annotations: READ_ONLY
  }, () => toolResult(async () => {
    const ids = await accessibleGameIds(event) ?? []
    return await prisma.game.findMany({
      where: { id: { in: ids } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, ...contentCounts }
    })
  }))

  server.registerTool('lire_jeu', {
    title: 'Lire un jeu',
    description: 'Présentation d’un jeu : description, note d’intention, attribut d’équilibre du casting.',
    inputSchema: z.object({ jeuId: z.string().describe('Identifiant du jeu (lister_jeux)') }),
    annotations: READ_ONLY
  }, ({ jeuId }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    return await prisma.game.findUniqueOrThrow({
      where: { id: jeuId },
      select: {
        id: true,
        title: true,
        description: true,
        noteIntention: true,
        balanceAttribute: true,
        balanceValues: true,
        singlePjPerParticipant: true,
        updatedAt: true,
        ...contentCounts
      }
    })
  }))
}
