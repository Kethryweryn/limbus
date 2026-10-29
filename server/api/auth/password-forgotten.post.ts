import { prisma } from '~/server/utils/prisma'
import { passwordForgottenSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { ACCOUNT_TOKEN_KINDS, ACCOUNT_TOKEN_TTL, assertEmailEnabled, createAccountToken, passwordUrl } from '~/server/utils/accounts'
import { sendPasswordLinkEmail } from '~/server/utils/email'

// Mot de passe oublié (US-062) : même réponse que le compte existe ou non
export default defineEventHandler(async (event) => {
  const { email } = await readZodBody(event, passwordForgottenSchema)
  assertRateLimit(event, { name: 'auth-password-forgotten-ip', limit: 5, windowMs: 15 * 60 * 1000 })
  assertRateLimit(event, { name: 'auth-password-forgotten-email', limit: 3, windowMs: 15 * 60 * 1000, keyParts: [email] })
  await assertEmailEnabled()

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, disabledAt: true } })
  if (user && !user.disabledAt) {
    const token = await createAccountToken(user.id, ACCOUNT_TOKEN_KINDS.password, ACCOUNT_TOKEN_TTL.passwordForgotten)
    await sendPasswordLinkEmail({ to: email, url: passwordUrl(token), created: false, validity: '1 heure' })
  }
  return { success: true }
})
