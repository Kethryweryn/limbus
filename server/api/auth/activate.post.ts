import { TERMS_VERSION } from '~/utils/legal'
import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { activationSchema, readZodBody } from '~/server/utils/schemas'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { ACCOUNT_TOKEN_KINDS, consumeAccountToken } from '~/server/utils/accounts'
import { hashPassword } from '~/server/utils/passwordHash'
import { linkParticipantsToUser } from '~/server/utils/participantAccounts'

/**
 * Activer un compte par le lien reçu (US-246, SPEC-022 R9, R11, ADR-0088) : le lien prouve l'adresse ; la personne
 * choisit son nom et son mot de passe, et accepte les conditions. Son nom est recopié sur ses fiches (ADR-0089) ; le
 * reste de ses coordonnées est vide, et chaque équipe garde les siennes. Elle est connectée.
 */
export default defineEventHandler(async (event) => {
  assertRateLimit(event, { name: 'auth-activate-ip', limit: 10, windowMs: 15 * 60 * 1000 })
  const body = await readZodBody(event, activationSchema)
  const record = await consumeAccountToken(body.token, [ACCOUNT_TOKEN_KINDS.activate])
  const current = await prisma.user.findUnique({ where: { id: record.userId }, select: { disabledAt: true, emailConfirmedAt: true } })
  if (!current || current.disabledAt) {
    throw createError({ statusCode: 400, message: 'Ce compte est désactivé.' })
  }
  if (current.emailConfirmedAt) {
    throw createError({ statusCode: 400, message: 'Ce compte est déjà activé : connectez-vous, ou choisissez un nouveau mot de passe si vous l’avez oublié.' })
  }

  const password = await hashPassword(body.password)
  const [, user] = await prisma.$transaction([
    // Les autres liens de ce compte (inscription non confirmée, ancien lien d'activation) tombent
    prisma.accountToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        name: body.name,
        password,
        emailConfirmedAt: new Date(),
        termsAcceptedVersion: TERMS_VERSION,
        termsAcceptedAt: new Date(),
        sessionVersion: { increment: 1 }
      },
      select: { id: true, email: true, sessionVersion: true }
    })
  ])
  // Ses fiches, déjà rattachées, reçoivent son nom (US-070, ADR-0089)
  await linkParticipantsToUser(user)
  setAuthCookie(event, user)
  return { success: true }
})
