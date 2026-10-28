import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { bequestExpiresAt, findPendingBequest, purgeExpiredBequests, requireBequestOwner } from '~/server/utils/bequests'
import { invitationUrl } from '~/server/utils/invitations'
import { sendGameBequestInvitationEmail } from '~/server/utils/email'
import { GAME_INVITATION_STATUSES } from '~/utils/domain'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'

// Renvoie l'invitation d'un legs en attente et prolonge son expiration ; la copie reste celle du legs (US-012, R9)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  const invitationId = getRouterParam(event, 'invitationId')
  if (!id || !invitationId) {
    throw createError({ statusCode: 400, message: 'Paramètre manquant' })
  }
  const { user, game } = await requireBequestOwner(event, id)
  assertRateLimit(event, {
    name: 'game-bequest-resend',
    limit: 10,
    windowMs: 60 * 60 * 1000,
    keyParts: [authUserRateLimitKey(event)]
  })
  // Un legs déjà expiré ne se renvoie pas : sa copie est supprimée, il faut léguer à nouveau
  await purgeExpiredBequests(id)
  const invitation = await findPendingBequest(id, invitationId)

  const expiresAt = bequestExpiresAt()
  const delivery = await sendGameBequestInvitationEmail({
    to: invitation.email,
    gameTitle: game.title,
    ownerName: user.name || user.email,
    url: invitationUrl(invitation.token),
    expiresAt
  }).catch((error: { message?: string }) => ({ sent: false, reason: error?.message || 'smtp_error' }))
  // Sans email parti, l'expiration ne bouge pas : la destinataire n'a reçu aucune nouvelle date
  if (!delivery.sent) {
    const reason = 'reason' in delivery && delivery.reason !== 'smtp_disabled' ? delivery.reason : 'envoi d’emails désactivé'
    throw createError({ statusCode: 502, message: `L’invitation n’a pas pu partir (${reason}).` })
  }

  await prisma.gameInvitation.updateMany({
    where: { id: invitation.id, status: GAME_INVITATION_STATUSES.pending },
    data: { expiresAt }
  })

  return { id: invitation.id, email: invitation.email, expiresAt }
})
