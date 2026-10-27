import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { countPlayableCharacters } from '~/server/utils/registrationPeriods'

// De quoi remplir le formulaire d'une période d'inscription : les sessions du jeu, avec la période
// qui les couvre déjà, et le nombre de personnages PJ (places proposées par défaut, R5)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const gameId = getRouterParam(event, 'id')
  if (!gameId) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireGameAccess(event, gameId)

  const [sessions, playableCharacters] = await Promise.all([
    prisma.session.findMany({
      where: { gameId },
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        date: true,
        status: true,
        registrationPeriodLink: { select: { periodId: true, period: { select: { name: true } } } }
      }
    }),
    countPlayableCharacters(gameId)
  ])

  return {
    playableCharacters,
    sessions: sessions.map(({ registrationPeriodLink, ...session }) => ({
      ...session,
      periodId: registrationPeriodLink?.periodId || null,
      periodName: registrationPeriodLink?.period.name || null
    }))
  }
})
