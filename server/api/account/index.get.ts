import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { storageUsage } from '~/server/utils/uploads'

// Mon compte (US-063, US-066)
export default defineEventHandler(async (event) => {
  const { id } = await requireUser(event)
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, email: true, storageQuotaMb: true } })
  const pendingEmail = await prisma.accountToken.findFirst({
    where: { userId: id, kind: 'email', usedAt: null, expiresAt: { gt: new Date() } },
    select: { email: true }
  })
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    pendingEmail: pendingEmail?.email ?? null,
    storage: await storageUsage(user)
  }
})
