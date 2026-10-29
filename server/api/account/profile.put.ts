import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accountProfileSchema, readZodBody } from '~/server/utils/schemas'
import { syncProfileToParticipants } from '~/server/utils/participantAccounts'

// Mes coordonnées (US-074) : enregistrées sur le compte, puis recopiées sur mes fiches et inscriptions
export default defineEventHandler(async (event) => {
  const { id } = await requireUser(event)
  const body = await readZodBody(event, accountProfileSchema)
  const now = new Date()
  await prisma.user.update({
    where: { id },
    data: {
      phone: body.phone || null,
      emergencyContactName: body.emergencyContactName || null,
      emergencyContactPhone: body.emergencyContactPhone || null,
      dietary: body.dietary || null,
      healthConsentAt: body.dietary ? now : null,
      profileUpdatedAt: now
    }
  })
  await syncProfileToParticipants(id)
  return { success: true }
})
