import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { linkAffinity, linkableAffinitySelect } from '~/server/utils/registrationAffinities'
import { affinityLinkSchema, readZodBody } from '~/server/utils/schemas'

// Rattacher une ligne d'affinité à une personne du jeu, la marquer inconnue ou la détacher (US-095, ADR-0049)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const affinity = await prisma.registrationAffinity.findUnique({
    where: { id: getRouterParam(event, 'id') || '' },
    select: linkableAffinitySelect
  })
  if (!affinity) throw createError({ statusCode: 404, message: 'Affinité introuvable' })
  await requireGameAccess(event, affinity.registration.period.gameId)
  const body = await readZodBody(event, affinityLinkSchema)

  return await linkAffinity(affinity, body)
})
