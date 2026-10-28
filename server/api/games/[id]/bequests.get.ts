import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { purgeExpiredBequests, requireBequestOwner } from '~/server/utils/bequests'
import { GAME_INVITATION_KINDS, GAME_INVITATION_STATUSES } from '~/utils/domain'

// Legs en attente du jeu : faits à des personnes sans compte, pas encore attribués (US-012)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireBequestOwner(event, id)
  // Un legs expiré disparaît, et sa copie avec ses fichiers (ADR-0020)
  await purgeExpiredBequests(id)

  // Les legs attribués n'apparaissent pas : la copie n'est plus en attente
  return await prisma.gameInvitation.findMany({
    where: {
      kind: GAME_INVITATION_KINDS.bequest,
      status: GAME_INVITATION_STATUSES.pending,
      game: { copiedFromGameId: id, bequestPending: true }
    },
    select: { id: true, email: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' }
  })
})
