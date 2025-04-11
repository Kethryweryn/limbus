import { PrismaClient } from '@prisma/client'
import { getAuthUser } from '@/server/utils/auth'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
    const user = getAuthUser(event)
    if (!user || user.role !== 'organizer') {
        return sendError(event, createError({ statusCode: 403, statusMessage: 'Forbidden' }))
    }

    return await prisma.game.findMany({
        orderBy: { createdAt: 'desc' }
    })
})
