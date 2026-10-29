import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { canAccessAllGames, accessibleGameWhere } from '~/server/utils/gameAccess'
import { CLOSED_SESSION_STATUSES } from '~/utils/domain'

export default defineEventHandler(async (event) => {
    await requireUser(event)
    const { user, allGames } = await canAccessAllGames(event)

    const games = await prisma.game.findMany({
        where: accessibleGameWhere(user.id, allGames),
        include: {
            owner: { select: { id: true, name: true, email: true } },
            shares: {
                include: { user: { select: { id: true, name: true, email: true, role: true } } }
            },
            characters: { select: { updatedAt: true } },
            factions: { select: { updatedAt: true } },
            intrigues: { select: { updatedAt: true } },
            items: { select: { updatedAt: true } },
            documents: { select: { updatedAt: true } },
            timelineEvents: { select: { updatedAt: true } },
            sessions: {
                where: {
                    date: { gte: new Date() },
                    status: { notIn: CLOSED_SESSION_STATUSES }
                },
                select: { id: true, name: true, date: true, status: true },
                orderBy: { date: 'asc' },
                take: 1
            }
        }
    })

    return games
        .map((game) => {
            const relatedDates = [
                ...game.characters.map((item) => item.updatedAt),
                ...game.factions.map((item) => item.updatedAt),
                ...game.intrigues.map((item) => item.updatedAt),
                ...game.items.map((item) => item.updatedAt),
                ...game.documents.map((item) => item.updatedAt),
                ...game.timelineEvents.map((item) => item.updatedAt)
            ]
            const lastActivityAt = new Date(Math.max(
                game.updatedAt.getTime(),
                ...relatedDates.map((date) => date.getTime())
            ))

            return {
                id: game.id,
                title: game.title,
                description: game.description,
                noteIntention: game.noteIntention,
                teaserUrl: game.teaserUrl,
                slug: game.slug,
                createdAt: game.createdAt,
                updatedAt: game.updatedAt,
                published: game.published,
                publicPage: game.publicPage,
                singlePjPerParticipant: game.singlePjPerParticipant,
                ownerId: game.ownerId,
                owner: game.owner,
                shares: game.shares,
                // Transfert proposé à la personne connectée (US-068)
                transferProposedToMe: game.transferToUserId === user.id,
                lastActivityAt,
                lastWritingActivityAt: lastActivityAt,
                nextScheduledSession: game.sessions[0] || null,
                nextScheduledSessionAt: game.sessions[0]?.date || null
            }
        })
        .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
})
