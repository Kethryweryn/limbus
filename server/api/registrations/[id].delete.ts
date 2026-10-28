import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnansweredInvitation, findRegistrationOr404 } from '~/server/utils/registrations'

// Annule une invitation sans réponse : l'inscription disparaît, et son lien avec elle
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const registration = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, registration.period.gameId)
  assertUnansweredInvitation(registration)

  // Condition répétée dans la suppression : une réponse arrivée entre-temps n'est pas effacée
  const { count } = await prisma.registration.deleteMany({
    where: { id: registration.id, status: registration.status, respondedAt: null }
  })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Cette invitation a déjà reçu une réponse' })
  }
  return { success: true }
})
