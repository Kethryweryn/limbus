import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { exposeRegistrationPeriod, registrationListSelect, registrationPeriodInclude } from '~/server/utils/registrationPeriods'

// ?gameId= filtre sur un jeu ; ?include=registrations ajoute les inscriptions de chaque période,
// pour que la page Inscriptions charge tout en une requête
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const { gameId, include } = getQuery(event)
  const withRegistrations = include === 'registrations'
  const periods = await prisma.registrationPeriod.findMany({
    where: await gameScopedWhere(event, typeof gameId === 'string' && gameId ? { gameId } : {}),
    orderBy: { createdAt: 'desc' },
    include: withRegistrations
      ? { ...registrationPeriodInclude, registrations: { orderBy: { createdAt: 'asc' as const }, select: registrationListSelect } }
      : registrationPeriodInclude
  })

  return periods.map(exposeRegistrationPeriod)
})
