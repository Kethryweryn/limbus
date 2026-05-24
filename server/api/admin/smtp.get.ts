import { requireAdmin } from '~/server/utils/auth'
import { getSmtpSettings, serializeSmtpSettings } from '~/server/utils/email'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return serializeSmtpSettings(await getSmtpSettings())
})
