import { prisma } from '~/server/utils/prisma'
import { readZodBody, signupSchema } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { ACCOUNT_TOKEN_KINDS, ACCOUNT_TOKEN_TTL, assertEmailEnabled, confirmUrl, createAccountToken, hashPassword, isSignupOpen, passwordForgottenUrl, purgeUnconfirmedAccounts } from '~/server/utils/accounts'
import { sendAccountConfirmationEmail, sendAccountExistsEmail } from '~/server/utils/email'
import { USER_ROLES } from '~/utils/domain'

// Inscription libre (US-061, R4 à R6). Même réponse que l'adresse soit libre ou prise : on ne révèle pas les comptes
export default defineEventHandler(async (event) => {
  if (!isSignupOpen()) {
    throw createError({ statusCode: 403, message: 'L’inscription n’est pas ouverte.' })
  }
  assertRateLimit(event, { name: 'auth-signup-ip', limit: 5, windowMs: 60 * 60 * 1000 })
  const body = await readZodBody(event, signupSchema)
  // Champ piège rempli : un robot. Il croit avoir réussi
  if (body.website) return { success: true }

  await assertEmailEnabled()
  await purgeUnconfirmedAccounts()

  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true, emailConfirmedAt: true } })
  if (existing?.emailConfirmedAt) {
    await sendAccountExistsEmail({ to: body.email, url: passwordForgottenUrl() })
    return { success: true }
  }

  // Un compte non confirmé à cette adresse reçoit un nouveau lien ; son nom et son mot de passe ne changent pas
  const user = existing ?? await prisma.user.create({
    data: { email: body.email, name: body.name, password: await hashPassword(body.password), role: USER_ROLES.user, emailConfirmedAt: null },
    select: { id: true, emailConfirmedAt: true }
  })
  const token = await createAccountToken(user.id, ACCOUNT_TOKEN_KINDS.confirm, ACCOUNT_TOKEN_TTL.confirm)
  await sendAccountConfirmationEmail({ to: body.email, url: confirmUrl(token) })
  return { success: true }
})
