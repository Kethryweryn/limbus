import { requireUser } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { TERMS_VERSION } from '~/utils/legal'

// Accepter la version en cours des conditions d'utilisation (US-111, ADR-0055)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await prisma.user.update({ where: { id: user.id }, data: { termsAcceptedVersion: TERMS_VERSION, termsAcceptedAt: new Date() } })
  return { termsAccepted: true }
})
