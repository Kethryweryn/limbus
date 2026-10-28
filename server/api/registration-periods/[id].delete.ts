import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'

// Une période qui a des inscriptions ne se supprime pas : on la clôture, pour garder la trace du recrutement
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const { id, gameId } = await findRegistrationPeriodOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, gameId)

  if (await prisma.registration.count({ where: { periodId: id } })) {
    throw createError({ statusCode: 409, message: 'Cette période d’inscription a des inscriptions : clôturez-la plutôt que de la supprimer' })
  }
  await prisma.registrationPeriod.delete({ where: { id } })
  return { success: true }
})
