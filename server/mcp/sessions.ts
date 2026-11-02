import * as z from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess, requireSessionAccess } from '~/server/utils/gameAccess'
import { READ_ONLY, named, toolResult, type ToolContext } from '~/server/mcp/tools'

// Sessions (R7) : détails, équipe, casting et déroulé. Ni paiements, ni RIB, ni photos d'attribution, ni fiche allergies
export function registerSessionTools({ event, server }: ToolContext) {
  server.registerTool('lister_sessions', {
    title: 'Lister les sessions',
    description: 'Sessions d’un jeu, avec leur date, leur statut, leur lieu et le nombre de rôles distribués.',
    inputSchema: z.object({ jeuId: z.string() }),
    annotations: READ_ONLY
  }, ({ jeuId }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    return await prisma.session.findMany({
      where: { gameId: jeuId },
      orderBy: [{ date: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
      select: {
        id: true, name: true, date: true, status: true, published: true, location: named,
        _count: { select: { participants: true, assignments: true } }
      }
    })
  }))

  server.registerTool('lire_session', {
    title: 'Lire une session',
    description: 'Détails d’une session, son équipe (rôle de chaque personne), son casting (personnage, personne, verrou, notes) et son déroulé (responsables des événements de la chronologie).',
    inputSchema: z.object({ sessionId: z.string() }),
    annotations: READ_ONLY
  }, ({ sessionId }) => toolResult(async () => {
    await requireSessionAccess(event, sessionId)
    const [session, timeline] = await Promise.all([
      prisma.session.findUniqueOrThrow({
        where: { id: sessionId },
        select: {
          id: true, gameId: true, name: true, date: true, status: true, cancelledAt: true, published: true, poolSeats: true, updatedAt: true,
          location: named,
          postponedTo: named,
          postponedFrom: named,
          participants: { orderBy: { participant: { name: 'asc' } }, select: { role: true, participant: named } },
          assignments: { orderBy: { character: { name: 'asc' } }, select: { character: named, participant: named, locked: true, notes: true } }
        }
      }),
      prisma.timelineEventResponsible.findMany({
        where: { sessionId },
        orderBy: [{ timelineEvent: { day: 'asc' } }, { timelineEvent: { time: 'asc' } }],
        select: { timelineEvent: { select: { id: true, name: true, day: true, time: true } }, participant: named }
      })
    ])
    return { ...session, timeline }
  }))
}
