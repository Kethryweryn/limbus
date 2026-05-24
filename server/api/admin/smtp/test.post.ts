import { requireAdmin } from '~/server/utils/auth'
import { sendEmail } from '~/server/utils/email'
import { readZodBody, smtpTestSchema } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const body = await readZodBody(event, smtpTestSchema)

  const result = await sendEmail({
    to: body.to,
    subject: 'Test SMTP Limbus',
    text: `Ceci est un email de test envoyé depuis Limbus par ${user.name}.`,
    html: `<p>Ceci est un email de test envoyé depuis Limbus par <strong>${user.name}</strong>.</p>`
  })

  if (!result.sent) {
    throw createError({
      statusCode: 400,
      statusMessage: 'SMTP désactivé'
    })
  }

  return result
})
