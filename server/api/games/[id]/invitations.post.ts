import { prisma } from '~/server/utils/prisma'
import { requireOrganizer } from '~/server/utils/auth'
import { requireGameOwner } from '~/server/utils/gameAccess'
import { gameInvitationCreateSchema, readZodBody } from '~/server/utils/schemas'
import { GAME_INVITATION_STATUSES } from '~/utils/domain'
import { createInvitationToken, invitationUrl, normalizeInvitationEmail } from '~/server/utils/invitations'

export default defineEventHandler(async (event) => {
  requireOrganizer(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
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
    select: { ownerId: true }
  })

  if (existingUser?.id === game?.ownerId) {
    throw createError({ statusCode: 400, statusMessage: 'Cet utilisateur possède déjà ce jeu' })
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
      throw createError({ statusCode: 400, statusMessage: 'Cet utilisateur a déjà accès au jeu' })
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

  return {
    ...invitation,
    invitationUrl: invitationUrl(event, invitation.token)
  }
})
