import { requireAdmin } from '~/server/utils/auth'
import { serializeSmtpSettings, upsertSmtpSettings } from '~/server/utils/email'
import { readZodBody, smtpSettingsSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readZodBody(event, smtpSettingsSchema)

  const settings = await upsertSmtpSettings(body)
  return serializeSmtpSettings(settings)
})
