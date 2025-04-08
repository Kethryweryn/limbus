import { prisma } from '~/server/utils/prisma' // ajuste si l'import change

export default defineEventHandler(async () => {
    const gamesCount = await prisma.game.count()
    const organizersCount = await prisma.user.count({ where: { role: 'organizer' } })
    const nextSession = await prisma.session.findFirst({
        where: { date: { gte: new Date() } },
        orderBy: { date: 'asc' },
    })

    return {
        gamesCount,
        organizersCount,
        nextSessionDate: nextSession?.date,
    }
})
