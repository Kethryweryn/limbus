import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { readZodBody, sessionPaymentStatusSchema } from '~/server/utils/schemas'
import { setSessionPaymentStatus } from '~/server/utils/sessionPayments'

export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const participantId = getRouterParam(event, 'participantId')
  if (!id || !participantId) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireSessionAccess(event, id)

  const body = await readZodBody(event, sessionPaymentStatusSchema)
  return await setSessionPaymentStatus(id, participantId, body.paid)
})
