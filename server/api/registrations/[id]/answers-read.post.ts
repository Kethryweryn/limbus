import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { prisma } from '~/server/utils/prisma'
import { findRegistrationOr404 } from '~/server/utils/registrations'
import { readZodBody, registrationSessionTargetSchema } from '~/server/utils/schemas'

// Repère « réponses modifiées » marqué comme lu : il disparaît pour toute l'équipe (R16)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  const { sessionId } = await readZodBody(event, registrationSessionTargetSchema)
  await prisma.registrationSession.updateMany({ where: { registrationId: registration.id, sessionId }, data: { answersChangedAt: null } })
  return { success: true }
})
