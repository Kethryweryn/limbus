import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { passwordResetSchema, readZodBody } from '~/server/utils/schemas'
import { ACCOUNT_TOKEN_KINDS, consumeAccountToken, hashPassword } from '~/server/utils/accounts'
import { linkParticipantsToUser } from '~/server/utils/participantAccounts'

// Nouveau mot de passe par le lien reçu (US-062, US-065) : déconnecte tous les appareils, puis connecte celui-ci
export default defineEventHandler(async (event) => {
  const body = await readZodBody(event, passwordResetSchema)
  const record = await consumeAccountToken(body.token, [ACCOUNT_TOKEN_KINDS.password])
  const current = await prisma.user.findUnique({ where: { id: record.userId }, select: { disabledAt: true, emailConfirmedAt: true } })
  if (!current || current.disabledAt) {
    throw createError({ statusCode: 400, message: 'Ce compte est désactivé.' })
  }

  // Le lien est arrivé dans la boîte : l'adresse est confirmée
  const user = await prisma.user.update({
    where: { id: record.userId },
    data: { password: await hashPassword(body.password), sessionVersion: { increment: 1 }, emailConfirmedAt: current.emailConfirmedAt ?? new Date() },
    select: { id: true, email: true, sessionVersion: true }
  })
  // Adresse confirmée par ce lien : ses fiches participant se rattachent (US-070)
  await linkParticipantsToUser(user)
  setAuthCookie(event, user)
  return { success: true }
})
