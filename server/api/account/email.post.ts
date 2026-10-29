import bcrypt from 'bcrypt'
import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { accountEmailSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { ACCOUNT_TOKEN_KINDS, ACCOUNT_TOKEN_TTL, assertEmailEnabled, confirmUrl, createAccountToken } from '~/server/utils/accounts'
import { sendEmailChangeConfirmationEmail } from '~/server/utils/email'

// Changer son email (US-063) : le mot de passe est exigé, l'adresse ne change qu'à la confirmation du lien
export default defineEventHandler(async (event) => {
  const { id } = await requireUser(event)
  const body = await readZodBody(event, accountEmailSchema)
  assertRateLimit(event, { name: 'account-email', limit: 5, windowMs: 15 * 60 * 1000, keyParts: [id] })

  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { email: true, password: true } })
  if (!await bcrypt.compare(body.password, user.password)) {
    throw createError({ statusCode: 400, message: 'Mot de passe incorrect.' })
  }
  if (body.email === user.email) {
    throw createError({ statusCode: 400, message: 'C’est déjà l’adresse de votre compte.' })
  }
  if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })) {
    throw createError({ statusCode: 409, message: 'Cette adresse est déjà utilisée par un autre compte.' })
  }

  await assertEmailEnabled()
  const token = await createAccountToken(id, ACCOUNT_TOKEN_KINDS.email, ACCOUNT_TOKEN_TTL.email, body.email)
  await sendEmailChangeConfirmationEmail({ to: body.email, url: confirmUrl(token) })
  return { success: true, pendingEmail: body.email }
})
