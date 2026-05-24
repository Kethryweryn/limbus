import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { gameInvitationCreateSchema, readZodBody } from '~/server/utils/schemas'
import { GAME_INVITATION_STATUSES } from '~/utils/domain'
import { createInvitationToken, invitationUrl, normalizeInvitationEmail } from '~/server/utils/invitations'
import { sendGameInvitationEmail } from '~/server/utils/email'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID manquant' })
  }
  const { user } = await requireGameOwner(event, id)
  const body = await readZodBody(event, gameInvitationCreateSchema)
  const email = normalizeInvitationEmail(body.email)

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  })
  const game = await prisma.game.findUnique({
    where: { id },
    select: { ownerId: true, title: true }
  })

  if (existingUser?.id === game?.ownerId) {
    throw createError({ statusCode: 400, message: 'Cet utilisateur possède déjà ce jeu' })
  }
  if (existingUser) {
    const existingShare = await prisma.gameShare.findUnique({
      where: {
        gameId_userId: {
          gameId: id,
          userId: existingUser.id
        }
      }
    })
    if (existingShare) {
      throw createError({ statusCode: 400, message: 'Cet utilisateur a déjà accès au jeu' })
    }
  }

  await prisma.gameInvitation.updateMany({
    where: {
      gameId: id,
      email,
      status: GAME_INVITATION_STATUSES.pending
    },
    data: {
      status: GAME_INVITATION_STATUSES.revoked
    }
  })

  const invitation = await prisma.gameInvitation.create({
    data: {
      gameId: id,
      email,
      token: createInvitationToken(),
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
      acceptedBy: { select: { id: true, name: true, email: true } }
    }
  })
  const url = invitationUrl(event, invitation.token)
  let emailDelivery = null

  try {
    emailDelivery = await sendGameInvitationEmail({
      to: invitation.email,
      gameTitle: game?.title || 'Limbus',
      inviterName: user.name || user.email,
      url
    })
  } catch (error: any) {
    console.warn('Game invitation email failed', {
      gameId: id,
      invitationId: invitation.id,
      email: invitation.email,
      error: error?.statusMessage || error?.message || 'smtp_error'
    })
    emailDelivery = {
      sent: false,
      reason: error?.statusMessage || error?.message || 'smtp_error'
    }
  }

  return {
    ...invitation,
    invitationUrl: url,
    emailDelivery
  }
})
