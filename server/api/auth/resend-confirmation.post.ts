import { requireAuthUser } from '~/server/utils/auth'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { ACCOUNT_TOKEN_KINDS, ACCOUNT_TOKEN_TTL, assertEmailEnabled, confirmUrl, createAccountToken } from '~/server/utils/accounts'
import { sendAccountConfirmationEmail } from '~/server/utils/email'

// Seule action d'un compte dont l'adresse n'est pas confirmée (R5)
export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event, { allowUnconfirmed: true })
  if (user.emailConfirmed) return { success: true, alreadyConfirmed: true }
  assertRateLimit(event, { name: 'auth-resend-confirmation', limit: 3, windowMs: 15 * 60 * 1000, keyParts: [user.id] })

  await assertEmailEnabled()
  const token = await createAccountToken(user.id, ACCOUNT_TOKEN_KINDS.confirm, ACCOUNT_TOKEN_TTL.confirm)
  await sendAccountConfirmationEmail({ to: user.email, url: confirmUrl(token) })
  return { success: true, alreadyConfirmed: false }
})
