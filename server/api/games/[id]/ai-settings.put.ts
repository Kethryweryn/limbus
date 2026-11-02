import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { requireRouterParam } from '~/server/utils/routeParams'
import { gameAiSettingsSchema, readZodBody } from '~/server/utils/schemas'

// Réglage de la propriétaire (US-123, SPEC-014 R5) : désactivé, il coupe aussitôt les assistants des co-organisatrices
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = requireRouterParam(event, 'id')
  await requireGameOwner(event, id)
  const { aiForCoorganizers } = await readZodBody(event, gameAiSettingsSchema)
  await prisma.game.update({ where: { id }, data: { aiForCoorganizers } })
  return { aiForCoorganizers }
})
