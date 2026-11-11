import { labelSessions } from '~/server/utils/sessionLabels'
import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { gameScopedWhere } from '~/server/utils/gameAccess'
import { withGameValues } from '~/server/utils/participantValues'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  // Chaque session avec son libellé (SPEC-021) ; à la même date, dans l'ordre de création
  // Nom et téléphone de chaque personne tels que les tient l'équipe du jeu (ADR-0086)
  return await labelSessions(prisma, await withGameValues(await prisma.session.findMany({
    where: await gameScopedWhere(event),
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: {
      game: true,
      location: true,
      participants: {
        include: {
          participant: true
        }
      },
      assignments: {
        include: {
          character: true,
          participant: true
        },
        orderBy: {
          characterId: 'asc'
        }
      }
    }
  })))
})
