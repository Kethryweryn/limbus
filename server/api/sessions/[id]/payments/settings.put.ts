import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { readZodBody, sessionPaymentSettingsSchema } from '~/server/utils/schemas'
import { updateSessionPaymentSettings } from '~/server/utils/sessionPayments'
import { assertGameUploads } from '~/server/utils/uploads'
import { requireRouterParam } from '~/server/utils/routeParams'
import { assertVersion } from '~/server/utils/concurrency'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const session = await requireSessionAccess(event, id)
  const previous = await prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { paymentRibUrl: true, paymentSettingsUpdatedAt: true } })

  const body = await readZodBody(event, sessionPaymentSettingsSchema)
  // Les réglages ont leur propre version, à part de celle de la session (ADR-0036)
  assertVersion(event, previous.paymentSettingsUpdatedAt)
  await assertGameUploads([body.paymentRibUrl], session.gameId, { sessionFiles: true, keep: [previous.paymentRibUrl], label: 'RIB' })
  const updated = await updateSessionPaymentSettings(session.id, body)
  // Ancien RIB remplacé ou retiré : effacé du disque
  await deleteUnusedUploads([previous.paymentRibUrl])
  return updated
})
