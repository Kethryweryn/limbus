import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { requireRouterParam } from '~/server/utils/routeParams'
import { findCharacterRelationOr404 } from '~/server/utils/characterRelations'

// Supprimer une relation entre personnages (US-097)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const relation = await findCharacterRelationOr404(id)
  await requireGameAccess(event, relation.gameId)
  // Suppression rejouée hors ligne : refusée si la relation a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'characterRelation', id)

  await prisma.characterRelation.delete({ where: { id } })
  return { success: true }
})
