import { prisma } from '~/server/utils/prisma'
import { activationRequestSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { assertEmailEnabled, passwordForgottenUrl, sendActivationLink } from '~/server/utils/accounts'
import { sendAccountExistsEmail } from '~/server/utils/email'

// Activer mon compte (US-246, SPEC-022 R9, R10) : même réponse que l'adresse ait un compte ou non, comme « Mot de passe
// oublié ». Un compte non activé reçoit le lien d'activation, un compte activé l'email « vous avez déjà un compte »
export default defineEventHandler(async (event) => {
  const { email } = await readZodBody(event, activationRequestSchema)
  assertRateLimit(event, { name: 'auth-activation-ip', limit: 5, windowMs: 15 * 60 * 1000 })
  assertRateLimit(event, { name: 'auth-activation-email', limit: 3, windowMs: 15 * 60 * 1000, keyParts: [email] })
  await assertEmailEnabled()

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, disabledAt: true, emailConfirmedAt: true } })
  if (user && !user.disabledAt) {
    // Un échec d'envoi, noté côté serveur, ne change pas la réponse : sinon elle dirait que l'adresse a un compte
    await (user.emailConfirmedAt ? sendAccountExistsEmail({ to: user.email, url: passwordForgottenUrl() }) : sendActivationLink(user)).catch(() => undefined)
  }
  return { success: true }
})
