import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
    requireOrganizer(event)

    const games = await prisma.game.findMany({
        include: {
            characters: { select: { updatedAt: true } },
            factions: { select: { updatedAt: true } },
            intrigues: { select: { updatedAt: true } },
            items: { select: { updatedAt: true } }
        }
    })

    return games
        .map((game) => {
            const relatedDates = [
                ...game.characters.map((item) => item.updatedAt),
                ...game.factions.map((item) => item.updatedAt),
                ...game.intrigues.map((item) => item.updatedAt),
                ...game.items.map((item) => item.updatedAt)
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
                lastActivityAt
            }
        })
        .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
})
