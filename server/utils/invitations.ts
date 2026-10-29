import { prisma } from '~/server/utils/prisma'
import { hashRegistrationToken } from '~/server/utils/registrations'
import { GAME_INVITATION_KINDS, GAME_SHARE_ROLES, GAME_INVITATION_STATUSES, USER_ROLES } from '~/utils/domain'
import { deletePendingCopy } from '~/server/utils/gameCopy'
import { absoluteAppUrl } from '~/server/utils/appUrl'

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase()
}

// Seule l'empreinte du jeton est gardée, comme pour les liens personnels (ADR-0034, ADR-0018)
export { createRegistrationToken as createInvitationToken, hashRegistrationToken as hashInvitationToken } from '~/server/utils/registrations'

export function invitationUrl(token: string) {
  return absoluteAppUrl(`/invitations/${token}`)
}

export async function getValidInvitation(token: string) {
  const invitation = await prisma.gameInvitation.findUnique({
    where: { tokenHash: hashRegistrationToken(token) },
    include: {
      game: { select: { id: true, title: true, slug: true, bequestPending: true } },
      invitedBy: { select: { name: true, email: true } },
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
    // Legs expiré : la copie en attente ne peut plus être attribuée, elle part avec ses fichiers (R8, ADR-0020)
    if (invitation.kind === GAME_INVITATION_KINDS.bequest && invitation.game.bequestPending) {
      await deletePendingCopy(invitation.gameId)
      throw createError({ statusCode: 400, message: 'Invitation expirée : la copie léguée a été supprimée. Demandez à la personne qui vous l’a léguée de recommencer.' })
    }
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
  // Seul le compte de l'adresse invitée accepte, invitation comme legs (US-064, R8)
  if (normalizeInvitationEmail(user.email) !== normalizeInvitationEmail(invitation.email)) {
    throw createError({
      statusCode: 403,
      message: 'Cette invitation a été envoyée à une autre adresse : demandez une nouvelle invitation pour votre compte.',
      data: { wrongAccount: true }
    })
  }

  if (invitation.kind === GAME_INVITATION_KINDS.bequest) {
    await acceptBequest(invitation, userId)
    return { id: invitation.game.id, title: invitation.game.title, slug: invitation.game.slug }
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

/**
 * Legs à une personne sans compte (US-011, R8) : la copie en attente reçoit sa propriétaire, sans GameShare.
 * Les deux écritures sont conditionnelles : une invitation annulée ou une copie déjà attribuée entre-temps échoue.
 */
async function acceptBequest(invitation: { id: string, gameId: string, invitedById: string }, userId: string) {
  // On ne se lègue pas son propre jeu (R2), même avec le lien en main
  if (invitation.invitedById === userId) {
    throw createError({ statusCode: 400, message: 'Vous ne pouvez pas recevoir votre propre legs.' })
  }
  await prisma.$transaction(async (tx) => {
    const accepted = await tx.gameInvitation.updateMany({
      where: { id: invitation.id, status: GAME_INVITATION_STATUSES.pending },
      data: { status: GAME_INVITATION_STATUSES.accepted, acceptedById: userId, acceptedAt: new Date() }
    })
    const assigned = await tx.game.updateMany({
      where: { id: invitation.gameId, bequestPending: true, ownerId: null },
      data: { ownerId: userId, bequestPending: false }
    })
    if (!accepted.count || !assigned.count) {
      throw createError({ statusCode: 409, message: 'Ce legs a déjà été accepté ou annulé.' })
    }
  })
}

export async function createInvitedUser(email: string, name: string, password: string) {
  return await prisma.user.create({
    data: {
      email: normalizeInvitationEmail(email),
      name,
      password,
      role: USER_ROLES.user
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  })
}
