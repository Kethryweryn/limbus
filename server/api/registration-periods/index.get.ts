import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { exposeRegistrationPeriod, registrationListSelect, registrationPeriodInclude } from '~/server/utils/registrationPeriods'
import { withSessionPresence } from '~/server/utils/registrations'

// ?gameId= filtre sur un jeu ; ?include=registrations ajoute les inscriptions de chaque période,
// pour que la page Inscriptions charge tout en une requête
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const { gameId, include } = getQuery(event)
  const where = await gameScopedWhere(event, typeof gameId === 'string' && gameId ? { gameId } : {})
  if (include !== 'registrations') {
    const periods = await prisma.registrationPeriod.findMany({ where, orderBy: { createdAt: 'desc' }, include: registrationPeriodInclude })
    return periods.map(exposeRegistrationPeriod)
  }

  const periods = await prisma.registrationPeriod.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { ...registrationPeriodInclude, registrations: { orderBy: { createdAt: 'asc' as const }, select: registrationListSelect } }
  })
  // Présence dans la session vérifiée en une requête pour toutes les périodes
  const registrations = new Map((await withSessionPresence(periods.flatMap((period) => period.registrations)))
    .map((registration) => [registration.id, registration]))
  return periods.map((period) => exposeRegistrationPeriod({
    ...period,
    registrations: period.registrations.map((registration) => registrations.get(registration.id)!)
  }))
})
