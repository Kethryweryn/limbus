import { randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { GAME_SHARE_ROLES, GAME_INVITATION_STATUSES, USER_ROLES } from '~/utils/domain'
import { absoluteAppUrl } from '~/server/utils/appUrl'

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase()
}

export function createInvitationToken() {
  return randomBytes(32).toString('base64url')
}

export function invitationUrl(token: string) {
  return absoluteAppUrl(`/invitations/${token}`)
}

export async function getValidInvitation(token: string) {
  const invitation = await prisma.gameInvitation.findUnique({
    where: { token },
    include: {
      game: { select: { id: true, title: true, slug: true } },
      acceptedBy: { select: { id: true, email: true, name: true } }
    }
  })

  if (!invitation) {
    throw createError({ statusCode: 404, message: 'Invitation introuvable' })
  }
  if (invitation.status !== GAME_INVITATION_STATUSES.pending) {
    throw createError({ statusCode: 400, message: 'Invitation déjà utilisée ou annulée' })
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 400, message: 'Invitation expirée' })
  }

  return invitation
}

export async function acceptInvitationForUser(token: string, userId: string) {
  const invitation = await getValidInvitation(token)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true }
  })
  if (!user) {
    throw createError({ statusCode: 404, message: 'Utilisateur introuvable' })
  }

  await prisma.$transaction([
    prisma.gameShare.upsert({
      where: {
        gameId_userId: {
          gameId: invitation.gameId,
          userId
        }
      },
      update: { role: GAME_SHARE_ROLES.organizer },
      create: {
        gameId: invitation.gameId,
        userId,
        role: GAME_SHARE_ROLES.organizer
      }
    }),
    prisma.gameInvitation.update({
      where: { id: invitation.id },
      data: {
        status: GAME_INVITATION_STATUSES.accepted,
        acceptedById: userId,
        acceptedAt: new Date()
      }
    })
  ])

  return invitation.game
}

export async function createInvitedUser(email: string, name: string, password: string) {
  return await prisma.user.create({
    data: {
      email: normalizeInvitationEmail(email),
      name,
      password,
      role: USER_ROLES.organizer
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  })
}
