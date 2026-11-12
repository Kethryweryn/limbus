import { requireUser } from '~/server/utils/auth'
import { requireParticipantAccess } from '~/server/utils/gameAccess'
import { prisma } from '~/server/utils/prisma'
import { setPhotoRefusal } from '~/server/utils/photoRetention'
import { requireRouterParam } from '~/server/utils/routeParams'
import { photoRefusalSchema, readZodBody } from '~/server/utils/schemas'

// Refus de photo posé ou levé par l'équipe, à la demande de la personne (US-109). Une fiche rattachée à un compte
// activé est tenue par la personne (ADR-0042, US-244) : l'équipe peut poser le refus, pas le lever
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = requireRouterParam(event, 'id')
  await requireParticipantAccess(event, id)
  const { refused } = await readZodBody(event, photoRefusalSchema)
  if (!refused) {
    const participant = await prisma.participant.findUniqueOrThrow({ where: { id }, select: { user: { select: { emailConfirmedAt: true } } } })
    if (participant.user?.emailConfirmedAt) {
      throw createError({ statusCode: 403, message: 'Cette personne a un compte : elle seule peut accepter de nouveau une photo, depuis « Mon compte ».' })
    }
  }
  const result = await setPhotoRefusal([id], refused)
  return { refused, ...result }
})
