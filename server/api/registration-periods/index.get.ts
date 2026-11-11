import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere, queryGameFilter } from '~/server/utils/gameAccess'
import { exposeRegistrationPeriod, registrationListSelect, registrationPeriodInclude } from '~/server/utils/registrationPeriods'
import { withSessionPresence } from '~/server/utils/registrations'
import { withGameValues } from '~/server/utils/participantValues'

// Périodes avec leurs inscriptions, pour que la page Inscriptions charge tout en une requête ; ?gameId= filtre sur un
// jeu (le bloc d'un jeu qui se relit)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  // Noms tenus par l'équipe du jeu de chaque inscription (ADR-0086)
  const periods = await withGameValues(await prisma.registrationPeriod.findMany({
    where: await gameScopedWhere(event, queryGameFilter(event)),
    orderBy: { createdAt: 'desc' },
    include: { ...registrationPeriodInclude, registrations: { orderBy: { createdAt: 'asc' as const }, select: registrationListSelect } }
  }))
  // Présence dans la session vérifiée en une requête pour toutes les périodes
  const registrations = new Map((await withSessionPresence(periods.flatMap((period) => period.registrations)))
    .map((registration) => [registration.id, registration]))
  return await Promise.all(periods.map((period) => exposeRegistrationPeriod({
    ...period,
    registrations: period.registrations.map((registration) => registrations.get(registration.id)!)
  })))
})
