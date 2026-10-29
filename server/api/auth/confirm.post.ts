import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { accountTokenSchema, readZodBody } from '~/server/utils/schemas'
import { ACCOUNT_TOKEN_KINDS, consumeAccountToken } from '~/server/utils/accounts'
import { sendEmailChangedNoticeEmail } from '~/server/utils/email'

// Lien de confirmation : adresse d'une inscription (US-061) ou nouvelle adresse d'un compte (US-063)
export default defineEventHandler(async (event) => {
  const { token } = await readZodBody(event, accountTokenSchema)
  const record = await consumeAccountToken(token, [ACCOUNT_TOKEN_KINDS.confirm, ACCOUNT_TOKEN_KINDS.email])
  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true, email: true, disabledAt: true, emailConfirmedAt: true, sessionVersion: true }
  })
  if (!user || user.disabledAt) {
    throw createError({ statusCode: 400, message: 'Ce compte est désactivé.' })
  }

  if (record.kind === ACCOUNT_TOKEN_KINDS.confirm) {
    if (!user.emailConfirmedAt) await prisma.user.update({ where: { id: user.id }, data: { emailConfirmedAt: new Date() } })
    setAuthCookie(event, user)
    return { success: true }
  }

  // Changement d'adresse : elle a pu être prise depuis la demande (l'index unique tranche une course)
  const newEmail = record.email!
  if (await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } })) {
    throw createError({ statusCode: 409, message: 'Cette adresse est déjà utilisée par un autre compte.' })
  }
  await prisma.user.update({ where: { id: user.id }, data: { email: newEmail, emailConfirmedAt: new Date() } })
  // L'ancienne adresse est prévenue ; un échec d'envoi n'annule pas le changement
  await sendEmailChangedNoticeEmail({ to: user.email, newEmail }).catch(() => undefined)
  setAuthCookie(event, user)
  return { success: true, email: newEmail }
})
