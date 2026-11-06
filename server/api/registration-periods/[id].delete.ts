import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'

// Un vivier qui a des personnes ne se supprime pas : on le ferme, pour garder la trace du recrutement
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const { id, gameId } = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, gameId)

  if (await prisma.registration.count({ where: { periodId: id } })) {
    throw createError({ statusCode: 409, message: 'Ce vivier a des personnes inscrites : fermez-le plutôt que de le supprimer' })
  }
  await prisma.registrationPeriod.delete({ where: { id } })
  return { success: true }
})
