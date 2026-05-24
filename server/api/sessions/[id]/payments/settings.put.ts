import { requireOrganizer } from '~/server/utils/auth'
import { requireSessionAccess } from '~/server/utils/gameAccess'
import { readZodBody, sessionPaymentSettingsSchema } from '~/server/utils/schemas'
import { updateSessionPaymentSettings } from '~/server/utils/sessionPayments'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  await requireSessionAccess(event, id)

  const body = await readZodBody(event, sessionPaymentSettingsSchema)
  return await updateSessionPaymentSettings(id, body)
})
