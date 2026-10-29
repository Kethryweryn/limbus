import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { accountTokenSchema, readZodBody } from '~/server/utils/schemas'
import { ACCOUNT_TOKEN_KINDS, consumeAccountToken } from '~/server/utils/accounts'
import { sendEmailChangedNoticeEmail } from '~/server/utils/email'
import { linkParticipantsToUser } from '~/server/utils/participantAccounts'

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
    // Le mot de passe de l'inscription dont c'est le lien ; les autres sessions et liens de confirmation tombent
    const confirmed = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailConfirmedAt: user.emailConfirmedAt ?? new Date(),
        ...(record.passwordHash && !user.emailConfirmedAt ? { password: record.passwordHash, sessionVersion: { increment: 1 } } : {})
      },
      select: { id: true, sessionVersion: true }
    })
    await prisma.accountToken.deleteMany({ where: { userId: user.id, kind: ACCOUNT_TOKEN_KINDS.confirm, usedAt: null } })
    // Les fiches participant à cette adresse se rattachent au compte (US-070)
    await linkParticipantsToUser(user)
    setAuthCookie(event, confirmed)
    return { success: true }
  }

  // Changement d'adresse : elle a pu être prise depuis la demande, ou à l'instant (index unique)
  const newEmail = record.email!
  const taken = () => createError({ statusCode: 409, message: 'Cette adresse est déjà utilisée par un autre compte.' })
  if (await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } })) throw taken()
  try {
    await prisma.user.update({ where: { id: user.id }, data: { email: newEmail, emailConfirmedAt: new Date() } })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw taken()
    throw error
  }
  // Les fiches rattachées prennent la nouvelle adresse, sinon une modification par l'équipe les détacherait ;
  // celles qui portaient déjà la nouvelle adresse se rattachent (US-070, ADR-0041)
  await prisma.participant.updateMany({ where: { userId: user.id }, data: { email: newEmail } })
  await linkParticipantsToUser({ id: user.id, email: newEmail })
  // L'ancienne adresse est prévenue ; un échec d'envoi n'annule pas le changement
  await sendEmailChangedNoticeEmail({ to: user.email, newEmail }).catch(() => undefined)
  setAuthCookie(event, user)
  return { success: true, email: newEmail }
})
