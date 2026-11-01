import { requireAdmin } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'

// Violations de la CSP comptées pendant le mode rapport (US-106, ADR-0053), les plus récentes d'abord
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await prisma.cspViolation.findMany({
    select: { directive: true, blockedUri: true, documentPath: true, count: true, firstSeenAt: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
    take: 200
  })
})
