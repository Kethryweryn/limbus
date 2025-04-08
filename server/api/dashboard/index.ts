import { prisma } from '~/server/utils/prisma' // ajuste si l'import change

export default defineEventHandler(async () => {
    const gamesCount = await prisma.game.count()
    const organizersCount = await prisma.user.count({ where: { role: 'organizer' } })
    const nextSession = await prisma.session.findFirst({
        where: { date: { gte: new Date() } },
        orderBy: { date: 'asc' },
    })
    const recentActivity = await prisma.activity.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { user: true, game: true, createdAt: true },
    })

    return {
        gamesCount,
        organizersCount,
        nextSessionDate: nextSession?.date,
        recentActivity: recentActivity.map((a) => ({
            user: a.user.name,
            game: a.game.title,
            date: a.createdAt,
        }))
    }
})
