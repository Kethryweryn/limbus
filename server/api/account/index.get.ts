import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { storageUsage } from '~/server/utils/uploads'
import { ACCOUNT_TOKEN_KINDS } from '~/server/utils/accounts'

// Mon compte (US-063, US-066)
export default defineEventHandler(async (event) => {
  const { id } = await requireUser(event)
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, email: true, storageQuotaMb: true, phone: true, emergencyContactName: true, emergencyContactPhone: true, dietary: true, healthConsentAt: true, profileUpdatedAt: true } })
  const pendingEmail = await prisma.accountToken.findFirst({
    where: { userId: id, kind: ACCOUNT_TOKEN_KINDS.email, usedAt: null, expiresAt: { gt: new Date() } },
    select: { email: true }
  })
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    pendingEmail: pendingEmail?.email ?? null,
    // Mes coordonnées (US-074)
    profile: {
      phone: user.phone,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      dietary: user.dietary,
      healthConsent: Boolean(user.healthConsentAt),
      updatedAt: user.profileUpdatedAt
    },
    storage: await storageUsage(user)
  }
})
