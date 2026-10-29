import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { bequestExpiresAt, findPendingBequest, purgeExpiredBequests, requireBequestOwner, sendBequestInvitation } from '~/server/utils/bequests'
import { createInvitationToken, invitationUrl } from '~/server/utils/invitations'
import { GAME_INVITATION_STATUSES } from '~/utils/domain'
import { assertRateLimit, authUserRateLimitKey } from '~/server/utils/rateLimit'
import { requireRouterParam } from '~/server/utils/routeParams'

// Renvoie l'invitation d'un legs en attente et prolonge son expiration ; la copie reste celle du legs (US-012, R9)
export default defineEventHandler(async (event) => {
  await requireOrganizer(event)

  const id = requireRouterParam(event, 'id')
  const invitationId = requireRouterParam(event, 'invitationId')
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
  // Le jeton n'est pas gardé (ADR-0034) : le renvoi porte un nouveau lien. Sans email parti, rien ne change :
  // l'ancien lien reste valable et la destinataire n'a reçu aucune nouvelle date
  const { token, tokenHash } = createInvitationToken()
  await sendBequestInvitation({
    to: invitation.email,
    gameTitle: game.title,
    ownerName: user.name || user.email,
    url: invitationUrl(token),
    expiresAt
  }, '.')

  await prisma.gameInvitation.updateMany({
    where: { id: invitation.id, status: GAME_INVITATION_STATUSES.pending },
    data: { expiresAt, tokenHash }
  })

  return { id: invitation.id, email: invitation.email, expiresAt }
})
