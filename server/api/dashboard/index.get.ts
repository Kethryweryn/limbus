import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const gamesCount = await prisma.game.count()
  const organizersCount = await prisma.user.count({ where: { role: 'organizer' } })
  const nextSession = await prisma.session.findFirst({
    where: { date: { gte: new Date() } },
    orderBy: { date: 'asc' }
  })

  return {
    gamesCount,
    organizersCount,
    nextSessionDate: nextSession?.date
  }
})
