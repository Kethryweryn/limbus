import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { assertSameGame, requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { requireRouterParam } from '~/server/utils/routeParams'
import { characterRelationSchema, readZodBody } from '~/server/utils/schemas'
import { characterRelationInclude, findCharacterRelationOr404, relationGameId } from '~/server/utils/characterRelations'

// Modifier une relation entre personnages (US-097) ; elle ne change jamais de jeu
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const relation = await findCharacterRelationOr404(id)
  await requireGameAccess(event, relation.gameId)
  await assertUnmodifiedSince(event, 'characterRelation', id)

  const body = await readZodBody(event, characterRelationSchema)
  assertSameGame(relation.gameId, await relationGameId(body.fromCharacterId, body.toCharacterId))

  return await prisma.characterRelation.update({ where: { id }, data: body, include: characterRelationInclude })
})
