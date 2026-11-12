import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accountProfileSchema, readZodBody } from '~/server/utils/schemas'
import { clearedProfileFields, profileValuesSelect, syncProfileToParticipants } from '~/server/utils/participantAccounts'

// Mes coordonnées (US-074) : enregistrées sur le compte, puis recopiées champ par champ sur mes fiches et inscriptions (US-245)
export default defineEventHandler(async (event) => {
  const { id } = await requireUser(event)
  const body = await readZodBody(event, accountProfileSchema)
  const now = new Date()
  const before = await prisma.user.findUniqueOrThrow({ where: { id }, select: profileValuesSelect })
  const after = await prisma.user.update({
    where: { id },
    data: {
      phone: body.phone || null,
      emergencyContactName: body.emergencyContactName || null,
      emergencyContactPhone: body.emergencyContactPhone || null,
      dietary: body.dietary || null,
      healthConsentAt: body.dietary ? now : null,
      profileUpdatedAt: now
    },
    select: profileValuesSelect
  })
  // Champ par champ (ADR-0089) : un champ rempli remplace celui des équipes, un champ vidé leur revient vide
  await syncProfileToParticipants(id, clearedProfileFields(before, after))
  return { success: true }
})
