import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { collectUploadUrls, deleteUnusedUploads } from '~/server/utils/uploads'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  // Suppression rejouée hors ligne : refusée si l'élément a changé depuis sa lecture (ADR-0036)
  await assertUnmodifiedSince(event, 'session', session.id)

  // Paiements reçus ou inscriptions : on annule ou on reporte, on ne supprime pas (US-021)
  const [paidCount, registrationCount] = await Promise.all([
    prisma.sessionPayment.count({ where: { sessionId: session.id, OR: [{ paidAt: { not: null } }, { instalments: { some: {} } }] } }),
    prisma.registration.count({ where: { sessionId: session.id } })
  ])
  if (paidCount || registrationCount) {
    throw createError({
      statusCode: 409,
      message: 'Cette session a des paiements reçus ou des inscriptions : elle ne peut pas être supprimée. Annulez-la ou reportez-la depuis sa page, pour gérer les remboursements et les places.'
    })
  }

  const uploadUrls = await collectUploadUrls({ sessionId: session.id })
  await prisma.session.delete({
    where: { id: session.id }
  })
  await deleteUnusedUploads(uploadUrls)

  return { success: true }
})
