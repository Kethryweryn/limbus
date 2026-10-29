import { requireUser } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { characterTrombinoscopeSchema, readZodBody } from '~/server/utils/schemas'
import { saveCharacterTrombinoscopeConfig, trombinoscopeConfigVersion } from '~/server/utils/trombinoscopes'
import { assertVersion } from '~/server/utils/concurrency'
import { requireRouterParam } from '~/server/utils/routeParams'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const character = await prisma.character.findUnique({ where: { id }, select: { gameId: true } })
  if (!character) {
    throw createError({ statusCode: 404, message: 'Personnage introuvable' })
  }
  await requireGameAccess(event, character.gameId)

  const body = await readZodBody(event, characterTrombinoscopeSchema)
  assertVersion(event, await trombinoscopeConfigVersion(id))
  return await saveCharacterTrombinoscopeConfig(id, body.entries)
})
