import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { characterRelationSchema, readZodBody } from '~/server/utils/schemas'
import { characterRelationInclude, relationGameId } from '~/server/utils/characterRelations'

// Relier deux personnages du même jeu (US-097, ADR-0050)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const body = await readZodBody(event, characterRelationSchema)
  const gameId = await relationGameId(body.fromCharacterId, body.toCharacterId)
  await requireGameAccess(event, gameId)

  return await prisma.characterRelation.create({ data: { ...body, gameId }, include: characterRelationInclude })
})
