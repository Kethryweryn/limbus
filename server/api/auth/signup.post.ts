import { TERMS_VERSION } from '~/utils/legal'
import { prisma } from '~/server/utils/prisma'
import { readZodBody, signupSchema } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { ACCOUNT_TOKEN_KINDS, ACCOUNT_TOKEN_TTL, assertEmailEnabled, confirmUrl, createAccountToken, isSignupOpen, passwordForgottenUrl, purgeUnconfirmedAccounts } from '~/server/utils/accounts'
import { hashPassword } from '~/server/utils/passwordHash'
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

  // Adresse déjà connue mais non activée (inscription non confirmée, ou compte pré-créé pour une fiche, ADR-0088) : rien
  // ne s'écrit sur le compte avant la confirmation. Le lien porte le nom et le mot de passe de CETTE inscription, que la
  // confirmation applique avec les conditions : une inscription faite par un tiers avant la vraie personne ne lui impose
  // ni son nom ni son mot de passe (US-246)
  const passwordHash = await hashPassword(body.password)
  const user = existing ?? await prisma.user.create({
    // Conditions acceptées à l'inscription (US-111, ADR-0055)
    data: { email: body.email, name: body.name, password: passwordHash, role: USER_ROLES.user, emailConfirmedAt: null, termsAcceptedVersion: TERMS_VERSION, termsAcceptedAt: new Date() },
    select: { id: true, emailConfirmedAt: true }
  })
  const token = await createAccountToken(user.id, ACCOUNT_TOKEN_KINDS.confirm, ACCOUNT_TOKEN_TTL.confirm, { passwordHash, name: body.name, keepOthers: true })
  await sendAccountConfirmationEmail({ to: body.email, url: confirmUrl(token) })
  return { success: true }
})
